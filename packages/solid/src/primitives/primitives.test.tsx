import { Flare } from "@priemskiyyy/flare";
import type { DestinationStatus, FlareStatus } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { cleanup, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import type { JSX } from "solid-js";
import { afterEach, expect, test, vi } from "vitest";

import {
  FlareProvider,
  useDestinationStatus,
  useFlare,
  useFlareStatus,
} from "src/index";

const disposals: Array<() => void> = [];

afterEach(() => {
  cleanup();

  for (const dispose of disposals.splice(0).reverse()) {
    dispose();
  }
});

const create = (options: Parameters<typeof createMockAdapter>[0] = {}) => {
  const mock = createMockAdapter(options);
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  disposals.push(flare.dispose);

  return { mock, flare };
};

const Status = () => {
  const flare = useFlareStatus();
  const primary = useDestinationStatus("primary");

  return (
    <span>
      {flare().state}/{primary().state}
    </span>
  );
};

const renderWith = (
  initial: ReturnType<typeof create>["flare"],
  child: () => JSX.Element = () => <Status />,
) => {
  const [flare, setFlare] = createSignal(initial);

  const view = render(() => (
    <FlareProvider flare={flare()}>{child()}</FlareProvider>
  ));

  return { view, setFlare };
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

const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

test("a primitive used outside a provider fails with a message that names the provider", () => {
  expect(() => render(() => <Status />)).toThrow(
    expect.objectContaining({
      name: "FlareError",
      code: "INVALID_CONFIGURATION",
      message: "Flare primitives must be used within a FlareProvider.",
    }),
  );
});

test("useFlare follows the nearest provider's Flare, also when the provider is given another", () => {
  const first = create();
  const second = create();
  const seen: unknown[] = [];

  const Reader = () => {
    const flare = useFlare();

    return <span>{String(seen.push(flare()))}</span>;
  };

  const { setFlare } = renderWith(first.flare, () => <Reader />);

  setFlare(() => second.flare);

  expect(seen).toEqual([first.flare, second.flare]);
});

test("observing is passive: mounting the provider and every status primitive opens nothing and reports nothing", () => {
  const { mock, flare } = create();

  const { view } = renderWith(flare);

  expect(view.container.textContent).toBe("idle/idle");
  expect(flare.status.get()).toEqual({ state: "idle" });
  expect(mock.sessions).toEqual([]);
  expect(mock.submissions).toEqual([]);
});

test("the status primitives follow the runtime and one destination, to ready and to failed", () => {
  const { flare } = create();

  const failing = create({
    onOpen: () => {
      throw new Error("the SDK refused to start");
    },
  });

  const { view, setFlare } = renderWith(flare);

  flare.start();
  expect(view.container.textContent).toBe("started/ready");

  setFlare(() => failing.flare);
  failing.flare.start();
  expect(view.container.textContent).toBe("started/failed");
});

test("a destination name given as an accessor is followed when it changes", () => {
  const first = createMockAdapter();

  const second = createMockAdapter({
    onOpen: () => {
      throw new Error("not here");
    },
  });

  const flare = new Flare({
    destinations: { primary: first.adapter, backup: second.adapter },
  });

  disposals.push(flare.dispose);

  const [name, setName] = createSignal("primary");

  const Named = () => {
    const status = useDestinationStatus(name);

    return <span>{status().state}</span>;
  };

  const view = render(() => (
    <FlareProvider flare={flare}>
      <Named />
    </FlareProvider>
  ));

  flare.start();
  expect(view.container.textContent).toBe("ready");

  setName("backup");

  expect(view.container.textContent).toBe("failed");
});

test("a status callback is told about later changes, and not about the value it started with", () => {
  const { flare } = create();
  const flareChanges: FlareStatus[] = [];
  const destinationChanges: DestinationStatus[] = [];

  const Observed = () => {
    const status = useFlareStatus((next) => {
      flareChanges.push(next);
    });

    useDestinationStatus("primary", (next) => {
      destinationChanges.push(next);
    });

    return <span>{status().state}</span>;
  };

  const { view } = renderWith(flare, () => <Observed />);

  flare.start();

  expect(flareChanges).toEqual([{ state: "started" }]);
  expect(destinationChanges.map((status) => status.state)).toEqual(["ready"]);
  expect(view.container.textContent).toBe("started");
});

test("before it is mounted a status reads idle, even for a Flare that already started", () => {
  const { flare } = create();

  flare.start();

  const beforeMount: string[] = [];

  const Early = () => {
    const status = useFlareStatus();

    beforeMount.push(status().state);

    return <span>{status().state}</span>;
  };

  const { view } = renderWith(flare, () => <Early />);

  // The server and the hydrating render see the same, so their markup matches.
  expect(beforeMount).toEqual(["idle"]);
  expect(view.container.textContent).toBe("started");
});

test("unmounting stops observing and never starts, stops or disposes anything", async () => {
  const { mock, flare } = create();
  const live = countListeners(flare);
  const { view } = renderWith(flare);

  flare.start();
  await turn();

  expect(live.count).toBe(2);

  view.unmount();

  expect(live.count).toBe(0);
  expect(flare.status.get()).toEqual({ state: "started" });
  expect(mock.sessions[0]?.disposeCount).toBe(0);
});

test("a provider given another Flare moves its listeners to it", () => {
  const first = create();
  const second = create();
  const firstLive = countListeners(first.flare);
  const secondLive = countListeners(second.flare);
  const { setFlare } = renderWith(first.flare);

  expect(firstLive.count).toBe(2);

  setFlare(() => second.flare);

  expect(firstLive.count).toBe(0);
  expect(secondLive.count).toBe(2);
});
