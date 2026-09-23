import { Flare } from "@priemskiyyy/flare";
import type { DestinationStatus, FlareStatus } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { mount } from "@vue/test-utils";
import { afterEach, expect, test, vi } from "vitest";
import { defineComponent, h, nextTick, shallowRef } from "vue";

import {
  FlareProvider,
  useDestinationStatus,
  useFlare,
  useFlareStatus,
} from "src/index";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    cleanup();
  }
});

const create = (options: Parameters<typeof createMockAdapter>[0] = {}) => {
  const mock = createMockAdapter(options);
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  cleanups.push(flare.dispose);

  return { mock, flare };
};

const Status = defineComponent(() => {
  const flare = useFlareStatus();
  const primary = useDestinationStatus("primary");

  return () => h("span", `${flare.value.state}/${primary.value.state}`);
});

const render = (flare: Flare<Record<string, never>>, child = Status) => {
  const current = shallowRef(flare);

  const view = mount(
    defineComponent(
      () => () =>
        h(FlareProvider, { flare: current.value }, { default: () => h(child) }),
    ),
  );

  cleanups.push(() => view.unmount());

  return { view, current };
};

// Counts live listeners, so a leak shows as a number that does not return to zero.
const countListeners = (flare: ReturnType<typeof create>["flare"]) => {
  const live = { count: 0 };

  for (const observable of [
    flare.status,
    flare.destination("primary").status,
  ]) {
    const subscribe = observable.subscribe;

    vi.spyOn(observable, "subscribe").mockImplementation((listener) => {
      live.count += 1;

      const stop = subscribe(listener);

      return () => {
        live.count -= 1;
        stop();
      };
    });
  }

  return live;
};

test("a composable used outside a provider fails with a message that names the provider", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  expect(() => mount(Status)).toThrow(
    "Flare composables must be used within a FlareProvider.",
  );
  expect(warn).toHaveBeenCalled();
});

test("useFlare returns the nearest provider's Flare, and follows a provider that is given another", async () => {
  const first = create();
  const second = create();
  const seen: unknown[] = [];

  const Reader = defineComponent(() => {
    const flare = useFlare();

    return () => {
      seen.push(flare.value);

      return h("span");
    };
  });

  const { current } = render(first.flare, Reader);

  current.value = second.flare;
  await nextTick();

  expect(seen).toEqual([first.flare, second.flare]);
});

test("observing is passive: mounting the provider and every status composable opens nothing and reports nothing", () => {
  const { mock, flare } = create();

  const { view } = render(flare);

  expect(view.text()).toBe("idle/idle");
  expect(flare.status.get()).toEqual({ state: "idle" });
  expect(mock.openings).toEqual([]);
  expect(mock.submissions).toEqual([]);
});

test("the status composables follow the runtime and one destination, to ready and to failed", async () => {
  const { flare } = create({ holdOpen: true });

  const failing = create({
    onOpen: () => {
      throw new Error("the SDK refused to start");
    },
  });

  const { view, current } = render(flare);

  flare.start();
  await nextTick();
  expect(view.text()).toBe("started/starting");

  current.value = failing.flare;
  failing.flare.start();
  await nextTick();
  expect(view.text()).toBe("started/failed");
});

test("a destination name given as a getter is followed when it changes", async () => {
  const first = createMockAdapter();

  const second = createMockAdapter({
    available: { available: false, reason: "not here" },
  });

  const flare = new Flare({
    destinations: { primary: first.adapter, backup: second.adapter },
  });

  cleanups.push(flare.dispose);

  const name = shallowRef("primary");

  const Named = defineComponent(() => {
    const status = useDestinationStatus(() => name.value);

    return () => h("span", status.value.state);
  });

  const view = mount(
    defineComponent(
      () => () => h(FlareProvider, { flare }, { default: () => h(Named) }),
    ),
  );

  cleanups.push(() => view.unmount());
  flare.start();
  await nextTick();
  expect(view.text()).toBe("ready");

  name.value = "backup";
  await nextTick();

  expect(view.text()).toBe("unavailable");
});

test("a status callback is told about later changes, and not about the value it started with", async () => {
  const { flare } = create();
  const flareChanges: FlareStatus[] = [];
  const destinationChanges: DestinationStatus[] = [];

  const Observed = defineComponent(() => {
    const status = useFlareStatus((next) => {
      flareChanges.push(next);
    });

    useDestinationStatus("primary", (next) => {
      destinationChanges.push(next);
    });

    return () => h("span", status.value.state);
  });

  const { view } = render(flare, Observed);

  flare.start();
  await nextTick();

  expect(flareChanges).toEqual([{ state: "started" }]);
  expect(destinationChanges.map((status) => status.state)).toEqual([
    "starting",
    "ready",
  ]);
  expect(view.text()).toBe("started");
});

test("before it is mounted a status reads idle, even for a Flare that already started", async () => {
  const { flare } = create();

  flare.start();

  const beforeMount: string[] = [];

  const Early = defineComponent(() => {
    const status = useFlareStatus();

    beforeMount.push(status.value.state);

    return () => h("span", status.value.state);
  });

  const { view } = render(flare, Early);

  await nextTick();

  // The server and the hydrating render see the same, so their markup matches.
  expect(beforeMount).toEqual(["idle"]);
  expect(view.text()).toBe("started");
});

test("unmounting stops observing and never starts, stops or disposes anything", async () => {
  const { mock, flare } = create();
  const live = countListeners(flare);
  const { view } = render(flare);

  flare.start();
  await nextTick();

  expect(live.count).toBe(2);

  view.unmount();

  expect(live.count).toBe(0);
  expect(flare.status.get()).toEqual({ state: "started" });
  expect(mock.sessions[0]?.disposeCount).toBe(0);
});

test("a provider given another Flare moves its listeners to it", async () => {
  const first = create();
  const second = create();
  const firstLive = countListeners(first.flare);
  const secondLive = countListeners(second.flare);
  const { current } = render(first.flare);

  expect(firstLive.count).toBe(2);

  current.value = second.flare;
  await nextTick();

  expect(firstLive.count).toBe(0);
  expect(secondLive.count).toBe(2);
});
