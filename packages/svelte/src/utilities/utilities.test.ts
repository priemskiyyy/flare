import { Flare } from "@priemskiyyy/flare";
import type { DestinationStatus, FlareStatus } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, expect, test, vi } from "vitest";

import EarlyHarness from "./EarlyHarness.fixture.svelte";
import NamedHarness from "./NamedHarness.fixture.svelte";
import ObservedHarness from "./ObservedHarness.fixture.svelte";
import ReaderHarness from "./ReaderHarness.fixture.svelte";
import Status from "./Status.fixture.svelte";
import StatusHarness from "./StatusHarness.fixture.svelte";

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

test("a utility used outside a provider fails with a message that names the provider", () => {
  expect(() => render(Status)).toThrow(
    "Flare utilities must be used within a FlareProvider.",
  );
});

test("useFlare follows the nearest provider's Flare, also when the provider is given another", async () => {
  const first = create();
  const second = create();
  const seen: unknown[] = [];
  const view = render(ReaderHarness, { flare: first.flare, seen });

  await view.rerender({ flare: second.flare });

  expect(seen).toEqual([first.flare, second.flare]);
});

test("observing is passive: mounting the provider and every status utility opens nothing and reports nothing", async () => {
  const { mock, flare } = create();

  const view = render(StatusHarness, { flare });

  await tick();

  expect(view.container.textContent).toBe("idle/idle");
  expect(flare.status.get()).toEqual({ state: "idle" });
  expect(mock.openings).toEqual([]);
  expect(mock.submissions).toEqual([]);
});

test("the status utilities follow the runtime and one destination, to ready and to failed", async () => {
  const { flare } = create({ holdOpen: true });

  const failing = create({
    onOpen: () => {
      throw new Error("the SDK refused to start");
    },
  });

  const view = render(StatusHarness, { flare });

  await tick();

  flare.start();
  await tick();
  expect(view.container.textContent).toBe("started/starting");

  await view.rerender({ flare: failing.flare });
  failing.flare.start();
  await tick();
  expect(view.container.textContent).toBe("started/failed");
});

test("a destination name given as a getter is followed when it changes", async () => {
  const first = createMockAdapter();

  const second = createMockAdapter({
    available: { available: false, reason: "not here" },
  });

  const flare = new Flare({
    destinations: { primary: first.adapter, backup: second.adapter },
  });

  disposals.push(flare.dispose);

  const view = render(NamedHarness, { flare, name: "primary" });

  flare.start();
  await tick();
  expect(view.container.textContent).toBe("ready");

  await view.rerender({ name: "backup" });
  await tick();

  expect(view.container.textContent).toBe("unavailable");
});

test("a status callback is told about later changes, and not about the value it started with", async () => {
  const { flare } = create();
  const flareChanges: FlareStatus[] = [];
  const destinationChanges: DestinationStatus[] = [];

  const view = render(ObservedHarness, {
    flare,
    onFlare: (status) => flareChanges.push(status),
    onDestination: (status) => destinationChanges.push(status),
  });

  await tick();

  flare.start();
  await tick();

  expect(flareChanges).toEqual([{ state: "started" }]);
  expect(destinationChanges.map((status) => status.state)).toEqual([
    "starting",
    "ready",
  ]);
  expect(view.container.textContent).toBe("started");
});

test("before it is mounted a status reads idle, even for a Flare that already started", async () => {
  const { flare } = create();

  flare.start();

  const beforeMount: string[] = [];

  const view = render(EarlyHarness, { flare, beforeMount });

  await tick();

  // The server and the hydrating render see the same, so their markup matches.
  expect(beforeMount).toEqual(["idle"]);
  expect(view.container.textContent).toBe("started");
});

test("unmounting stops observing and never starts, stops or disposes anything", async () => {
  const { mock, flare } = create();
  const live = countListeners(flare);
  const view = render(StatusHarness, { flare });

  flare.start();
  await tick();

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
  const view = render(StatusHarness, { flare: first.flare });

  await tick();
  expect(firstLive.count).toBe(2);

  await view.rerender({ flare: second.flare });
  await tick();

  expect(firstLive.count).toBe(0);
  expect(secondLive.count).toBe(2);
});
