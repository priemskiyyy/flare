import { expect, test, vi } from "vitest";

import type { FlareSnapshot } from "src/types/FlareSnapshot";
import { Diagnostics } from "src/utils/internal/diagnostics/Diagnostics";

const snapshotOf = (pendingReceipts: number): FlareSnapshot => ({
  status: { state: "started" },
  generation: 0,
  breadcrumbs: 0,
  pendingReceipts,
  destinations: [],
});

const create = () => {
  const read = vi.fn(() => snapshotOf(read.mock.calls.length));
  const now = vi.fn(() => 42);
  const diagnostics = new Diagnostics({ read, now });
  return { diagnostics, read, now };
};

const event = {
  source: "report" as const,
  type: "report accepted",
  destination: null,
  report: "report-1",
  context: null,
};

test("the snapshot is read lazily and kept until something changes", () => {
  const { diagnostics, read } = create();

  expect(read).not.toHaveBeenCalled();

  const first = diagnostics.api.get();

  expect(diagnostics.api.get()).toBe(first);
  expect(read).toHaveBeenCalledTimes(1);

  diagnostics.changed();

  expect(diagnostics.api.get()).not.toBe(first);
});

test("several changes in one turn notify observers once", async () => {
  const { diagnostics } = create();
  const listener = vi.fn();
  diagnostics.api.subscribe(listener);

  diagnostics.changed();
  diagnostics.changed();
  diagnostics.changed();

  expect(listener).not.toHaveBeenCalled();

  await Promise.resolve();

  expect(listener).toHaveBeenCalledTimes(1);
});

test("an event is assembled only while someone listens", () => {
  const { diagnostics, now } = create();
  const listener = vi.fn();

  diagnostics.record(event);
  expect(now).not.toHaveBeenCalled();

  const stop = diagnostics.api.events.subscribe(listener);
  diagnostics.record(event);
  stop();
  diagnostics.record(event);

  expect(listener.mock.calls).toEqual([[{ ...event, timestamp: 42 }]]);
  expect(now).toHaveBeenCalledTimes(1);
});

test("a listener that throws does not stop the others", () => {
  vi.spyOn(globalThis, "queueMicrotask").mockImplementation(() => {});
  const { diagnostics } = create();
  const second = vi.fn();
  diagnostics.api.events.subscribe(() => {
    throw new Error("listener failed");
  });
  diagnostics.api.events.subscribe(second);

  diagnostics.record(event);

  expect(second).toHaveBeenCalledTimes(1);
});

test("disposal sends one last event and notification, then goes quiet with a stable snapshot", () => {
  const { diagnostics } = create();
  const listener = vi.fn();
  const events = vi.fn();
  diagnostics.api.subscribe(listener);
  diagnostics.api.events.subscribe(events);

  diagnostics.dispose();
  diagnostics.dispose();
  diagnostics.changed();
  diagnostics.record(event);

  expect(listener).toHaveBeenCalledTimes(1);
  expect(events.mock.calls).toEqual([
    [
      {
        source: "runtime",
        type: "disposed",
        destination: null,
        report: null,
        context: null,
        timestamp: 42,
      },
    ],
  ]);
  expect(diagnostics.api.get()).toBe(diagnostics.api.get());
});
