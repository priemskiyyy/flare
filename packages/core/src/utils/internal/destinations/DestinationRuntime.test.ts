import { afterEach, expect, test, vi } from "vitest";

import { createMockAdapter } from "src/mock/createMockAdapter";
import type { MockAdapterOptions } from "src/mock/createMockAdapter";
import type { DestinationOutcome } from "src/types/DestinationOutcome";
import type { SanitizedReport } from "src/types/SanitizedReport";
import { DestinationRuntime } from "src/utils/internal/destinations/DestinationRuntime";

afterEach(() => {
  vi.useRealTimers();
});

const reportOf = (
  id: string,
  kind: "message" | "exception" = "message",
): SanitizedReport => {
  const base = {
    id,
    timestamp: 1,
    level: "info" as const,
    identity: { generation: 0, user: null },
    tags: {},
    contexts: {},
    breadcrumbs: [],
    operation: null,
    losses: [],
  };
  if (kind === "message") {
    return { ...base, kind, message: id };
  }
  return {
    ...base,
    kind,
    exception: {
      origin: "error",
      name: "Error",
      message: id,
      stack: null,
      causes: [],
      aggregated: [],
    },
  };
};

const SUBMITTED: DestinationOutcome = {
  status: "submitted",
  evidence: "sdk-call-returned",
  event: null,
  losses: [],
};

const create = (
  options: MockAdapterOptions = {},
  overrides: {
    maxReports?: number;
    maxAgeMs?: number;
    deadlineMs?: number;
  } = {},
) => {
  const mock = createMockAdapter(options);
  const depth = { enter: vi.fn(), exit: vi.fn() };
  const runtime = new DestinationRuntime({
    name: "primary",
    adapter: mock.adapter,
    buffer: {
      maxReports: overrides.maxReports ?? 10,
      maxAgeMs: overrides.maxAgeMs ?? 60_000,
    },
    deadlineMs: overrides.deadlineMs ?? 5_000,
    now: () => Date.now(),
    currentGeneration: () => 7,
    readAmbient: () => ({ generation: 7, user: null, tags: {}, contexts: {} }),
    submitDepth: depth,
    record: () => {},
    changed: () => {},
  });
  const outcomes = new Map<string, DestinationOutcome[]>();
  const accept = (id: string, kind: "message" | "exception" = "message") => {
    outcomes.set(id, []);
    runtime.accept({
      report: reportOf(id, kind),
      settle: (outcome) => outcomes.get(id)?.push(outcome),
    });
  };
  return { mock, runtime, accept, outcomes, depth };
};

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

test("a destination is cold until started", () => {
  const { mock, runtime } = create();

  expect(runtime.status.get()).toEqual({ state: "idle" });
  expect(runtime.native).toBeNull();
  expect(mock.openings).toEqual([]);
});

test("an observed destination status cannot prevent startup", () => {
  const { mock, runtime } = create();

  Reflect.set(runtime.status.get(), "state", "disposed");
  runtime.start();

  expect(mock.openings).toHaveLength(1);
  expect(runtime.status.get()).toEqual({ state: "ready" });
});

test("a status observer cannot rewrite an opening destination", async () => {
  const { mock, runtime } = create({ holdOpen: true });
  runtime.status.subscribe(() => {
    const status = runtime.status.get();
    if (status.state === "starting") {
      Reflect.set(status, "state", "disposed");
    }
  });
  runtime.start();

  expect(runtime.status.get()).toEqual({ state: "starting" });
  mock.openings[0]?.settle();
  await flushMicrotasks();
  expect(runtime.status.get()).toEqual({ state: "ready" });
});

test("a ready status cannot rewrite another destination's status", () => {
  const first = create();
  const second = create();
  first.runtime.start();
  second.runtime.start();
  const status = first.runtime.status.get();

  try {
    Reflect.set(status, "state", "disposed");
    expect(second.runtime.status.get()).toEqual({ state: "ready" });
  } finally {
    Reflect.set(status, "state", "ready");
  }
});

test("starting opens the adapter once and exposes its native handle", () => {
  const { mock, runtime } = create();

  runtime.start();
  runtime.start();

  expect(mock.openings).toHaveLength(1);
  expect(mock.openings[0]?.context).toEqual({ destination: "primary" });
  expect(runtime.status.get()).toEqual({ state: "ready" });
  expect(runtime.native).toBe(mock.sessions[0]);
});

test("a slow start is visible as starting, then ready", async () => {
  const { mock, runtime } = create({ holdOpen: true });

  runtime.start();

  expect(runtime.status.get()).toEqual({ state: "starting" });
  expect(runtime.native).toBeNull();

  mock.openings[0]?.settle();
  await flushMicrotasks();

  expect(runtime.status.get()).toEqual({ state: "ready" });
});

test("an unavailable destination is never opened and skips what it is given", () => {
  const { mock, runtime, accept, outcomes } = create({
    available: { available: false, reason: "no native module" },
  });
  accept("before");

  runtime.start();
  accept("after");

  expect(mock.openings).toEqual([]);
  expect(runtime.status.get()).toEqual({
    state: "unavailable",
    reason: "no native module",
  });
  expect(outcomes.get("before")).toEqual([
    { status: "skipped", reason: "unavailable" },
  ]);
  expect(outcomes.get("after")).toEqual([
    { status: "skipped", reason: "unavailable" },
  ]);
});

test("reports accepted before ready are buffered and submitted in order", () => {
  const { mock, runtime, accept, outcomes } = create();
  accept("first");
  accept("second");

  expect(runtime.buffered).toBe(2);
  expect(outcomes.get("first")).toEqual([]);

  runtime.start();

  expect(mock.submissions.map((submission) => submission.report.id)).toEqual([
    "first",
    "second",
  ]);
  expect(outcomes.get("first")).toEqual([SUBMITTED]);
  expect(runtime.buffered).toBe(0);
});

test("a full buffer drops its oldest report and says so", () => {
  const { runtime, accept, outcomes } = create({}, { maxReports: 2 });
  accept("first");
  accept("second");
  accept("third");

  expect(outcomes.get("first")).toEqual([
    { status: "dropped", reason: "buffer-overflow" },
  ]);
  expect(runtime.buffered).toBe(2);
});

test("a buffered report that grows too old is dropped, so its receipt can settle", () => {
  vi.useFakeTimers();
  const { accept, outcomes } = create({}, { maxAgeMs: 1_000 });
  accept("old");
  vi.advanceTimersByTime(600);
  accept("young");

  vi.advanceTimersByTime(400);

  expect(outcomes.get("old")).toEqual([
    { status: "dropped", reason: "buffer-expired" },
  ]);
  expect(outcomes.get("young")).toEqual([]);

  vi.advanceTimersByTime(600);

  expect(outcomes.get("young")).toEqual([
    { status: "dropped", reason: "buffer-expired" },
  ]);
});

test("a start that throws leaves the destination failed and keeps its buffer for a retry", () => {
  let attempts = 0;
  const failure = new Error("init failed");
  const { runtime, accept, outcomes } = create({
    onOpen: () => {
      attempts += 1;
      if (attempts === 1) {
        throw failure;
      }
    },
  });
  accept("kept");

  runtime.start();

  expect(runtime.status.get()).toEqual({ state: "failed", error: failure });
  expect(outcomes.get("kept")).toEqual([]);

  runtime.start();

  expect(runtime.status.get()).toEqual({ state: "ready" });
  expect(outcomes.get("kept")).toEqual([SUBMITTED]);
});

test("a throwing then getter on an opened session cannot escape startup", () => {
  const { mock, runtime } = create();
  const open = mock.adapter.open;
  const failure = new Error("cannot inspect session");
  mock.adapter.open = (context) =>
    Object.defineProperty(open(context), "then", {
      get: () => {
        throw failure;
      },
    });

  expect(runtime.start).not.toThrow();
  expect(runtime.status.get()).toEqual({ state: "failed", error: failure });
});

test("a start that rejects behaves the same, and a retry can succeed", async () => {
  const failure = new Error("init rejected");
  const { mock, runtime, accept, outcomes } = create({ holdOpen: true });
  accept("kept");

  runtime.start();
  mock.openings[0]?.fail(failure);
  await flushMicrotasks();

  expect(runtime.status.get()).toEqual({ state: "failed", error: failure });
  expect(outcomes.get("kept")).toEqual([]);

  runtime.start();
  mock.openings[1]?.settle();
  await flushMicrotasks();

  expect(runtime.status.get()).toEqual({ state: "ready" });
  expect(outcomes.get("kept")).toEqual([SUBMITTED]);
});

test("a report that expires while start has failed is skipped as start-failed", async () => {
  vi.useFakeTimers();
  const { runtime, accept, outcomes } = create(
    {
      onOpen: () => {
        throw new Error("init failed");
      },
    },
    { maxAgeMs: 1_000 },
  );
  accept("stuck");
  runtime.start();

  vi.advanceTimersByTime(1_000);

  expect(outcomes.get("stuck")).toEqual([
    { status: "skipped", reason: "start-failed" },
  ]);
});
