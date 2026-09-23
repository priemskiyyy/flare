import { afterEach, expect, test, vi } from "vitest";

import { createMockAdapter } from "src/mock/createMockAdapter";
import type { MockAdapterOptions } from "src/mock/createMockAdapter";
import type { DestinationOutcome } from "src/types/DestinationOutcome";
import type { SanitizedReport } from "src/types/SanitizedReport";
import type { SubmissionResult } from "src/types/SubmissionResult";
import { DestinationRuntime } from "src/utils/internal/destinations/DestinationRuntime";

afterEach(() => {
  vi.useRealTimers();
});

const reportOf = (
  id: string,
  kind: "message" | "exception" = "message",
): SanitizedReport => {
  const base: Omit<SanitizedReport, "kind"> = {
    id,
    timestamp: 1,
    level: "info",
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

const SUBMITTED_RESULT: SubmissionResult = {
  status: "submitted",
  evidence: "sdk-call-returned",
  event: null,
  losses: [],
};

const create = (
  options: MockAdapterOptions = {},
  overrides: {
    capacity?: number;
    maxAge?: number;
    timeout?: number;
  } = {},
) => {
  const mock = createMockAdapter(options);
  const depth = { enter: vi.fn(), exit: vi.fn() };

  const runtime = new DestinationRuntime({
    name: "primary",
    adapter: mock.adapter,
    buffer: {
      capacity: overrides.capacity ?? 10,
      maxAge: overrides.maxAge ?? 60_000,
    },
    dedupe: { window: 1_000, maxKeys: 100 },
    timeout: overrides.timeout ?? 5_000,
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
    runtime.accept(
      {
        report: reportOf(id, kind),
        settle: (outcome) => outcomes.get(id)?.push(outcome),
      },
      { key: null, thrown: undefined },
    );
  };

  return { mock, runtime, accept, outcomes, depth };
};

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

test("a destination is cold until started", () => {
  const { mock, runtime } = create();

  expect(runtime.status.get()).toEqual({ state: "idle" });
  expect(runtime.native).toBeNull();
  expect(mock.sessions).toEqual([]);
});

test("an observed destination status cannot prevent startup", () => {
  const { mock, runtime } = create();

  Reflect.set(runtime.status.get(), "state", "disposed");
  runtime.start();

  expect(mock.sessions).toHaveLength(1);
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

  expect(mock.sessions).toHaveLength(1);
  expect(runtime.status.get()).toEqual({ state: "ready" });
  expect(runtime.native).toBe(mock.sessions[0]);
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
  const { runtime, accept, outcomes } = create({}, { capacity: 2 });

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

  const { accept, outcomes } = create({}, { maxAge: 1_000 });

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

test("a report that expires while start has failed is skipped as start-failed", async () => {
  vi.useFakeTimers();

  const { runtime, accept, outcomes } = create(
    {
      onOpen: () => {
        throw new Error("init failed");
      },
    },
    { maxAge: 1_000 },
  );

  accept("stuck");
  runtime.start();

  vi.advanceTimersByTime(1_000);

  expect(outcomes.get("stuck")).toEqual([
    { status: "skipped", reason: "start-failed" },
  ]);
});

test("a held submission settles with what the provider answers", async () => {
  const { mock, runtime, accept, outcomes } = create({ hold: true });

  runtime.start();
  accept("report");

  expect(runtime.inFlight).toBe(1);

  mock.submissions[0]?.settle({
    status: "submitted",
    evidence: "sdk-callback-completed",
    event: { id: "evt_1" },
    losses: [{ path: "breadcrumbs", reason: "unsupported" }],
  });
  await flushMicrotasks();

  expect(outcomes.get("report")).toEqual([
    {
      status: "submitted",
      evidence: "sdk-callback-completed",
      event: { id: "evt_1" },
      losses: [{ path: "breadcrumbs", reason: "unsupported" }],
    },
  ]);
  expect(runtime.inFlight).toBe(0);
});

test("a provider that rejects or throws is a failure of that report only", async () => {
  const rejection = new Error("network down");
  const thrown = new Error("sdk threw");
  const rejecting = create({ hold: true });

  const throwing = create({
    onSubmit: () => {
      throw thrown;
    },
  });

  for (const each of [rejecting, throwing]) {
    each.runtime.start();
    each.accept("report");
  }

  rejecting.mock.submissions[0]?.fail(rejection);
  await flushMicrotasks();

  expect(rejecting.outcomes.get("report")).toEqual([
    { status: "failed", error: rejection },
  ]);
  expect(throwing.outcomes.get("report")).toEqual([
    { status: "failed", error: thrown },
  ]);
  expect(throwing.runtime.status.get()).toEqual({ state: "ready" });
});

test("a hanging provider is cut off at the deadline as indeterminate, and its late answer is ignored", async () => {
  vi.useFakeTimers();

  const { mock, runtime, accept, outcomes } = create(
    { hold: true },
    { timeout: 5_000 },
  );

  runtime.start();
  accept("slow");

  vi.advanceTimersByTime(4_999);

  expect(outcomes.get("slow")).toEqual([]);

  vi.advanceTimersByTime(1);

  expect(outcomes.get("slow")).toEqual([
    { status: "indeterminate", reason: "timeout" },
  ]);
  expect(mock.submissions[0]?.context.signal.aborted).toBe(true);

  mock.submissions[0]?.settle();
  await vi.advanceTimersByTimeAsync(0);

  expect(outcomes.get("slow")).toHaveLength(1);
});

test("the adapter is told the current identity generation and its synchronous work is bracketed", () => {
  const { mock, runtime, accept, depth } = create({ hold: true });

  runtime.start();

  accept("report");

  expect(mock.submissions[0]?.context.currentGeneration()).toBe(7);
  expect(depth.enter).toHaveBeenCalledTimes(1);
  expect(depth.exit).toHaveBeenCalledTimes(1);
});

test("disposal settles everything it holds and refuses what comes later", async () => {
  const { mock, runtime, accept, outcomes } = create({ hold: true });

  runtime.start();
  accept("in-flight");

  const idle = create();

  idle.accept("buffered");

  runtime.dispose();
  runtime.dispose();
  idle.runtime.dispose();
  accept("late");

  expect(outcomes.get("in-flight")).toEqual([
    { status: "indeterminate", reason: "disposed" },
  ]);
  expect(idle.outcomes.get("buffered")).toEqual([
    { status: "dropped", reason: "disposed" },
  ]);
  expect(outcomes.get("late")).toEqual([
    { status: "dropped", reason: "disposed" },
  ]);
  expect(mock.submissions[0]?.context.signal.aborted).toBe(true);
  expect(mock.sessions[0]?.disposeCount).toBe(1);
  expect(runtime.status.get()).toEqual({ state: "disposed" });
  expect(runtime.native).toBeNull();

  mock.submissions[0]?.settle();
  await flushMicrotasks();

  expect(outcomes.get("in-flight")).toHaveLength(1);
});

test("a session opened while its destination was disposed from inside open is released at once and never used", () => {
  const { mock, runtime, accept } = create({
    onOpen: () => runtime.dispose(),
  });

  runtime.start();
  accept("late");

  expect(mock.sessions[0]?.disposeCount).toBe(1);
  expect(mock.submissions).toEqual([]);
  expect(runtime.status.get()).toEqual({ state: "disposed" });
});

test("a destination disposed from inside a failing open stays disposed", () => {
  const { runtime } = create({
    onOpen: () => {
      runtime.dispose();
      throw new Error("init failed");
    },
  });

  runtime.start();
  runtime.start();

  expect(runtime.status.get()).toEqual({ state: "disposed" });
});

test("disposing from the ready notification releases the session before any buffered report is submitted", () => {
  const { mock, runtime, accept, outcomes } = create();

  accept("buffered");
  runtime.status.subscribe(() => {
    if (runtime.status.get().state === "ready") {
      runtime.dispose();
    }
  });

  runtime.start();

  expect(mock.submissions).toEqual([]);
  expect(mock.sessions[0]?.disposeCount).toBe(1);
  expect(outcomes.get("buffered")).toEqual([
    { status: "dropped", reason: "disposed" },
  ]);
});

test.each([
  {
    label: "throws",
    dispose: () => {
      throw new Error("close threw");
    },
  },
  {
    label: "rejects",
    dispose: () => Promise.reject(new Error("close rejected")),
  },
])("a session whose disposal $label cannot break the host", async (row) => {
  const unhandled = vi.fn();

  process.on("unhandledRejection", unhandled);

  const mock = createMockAdapter();

  const runtime = new DestinationRuntime({
    name: "primary",
    adapter: {
      ...mock.adapter,
      open: () => ({
        native: null,
        submit: () => SUBMITTED_RESULT,
        dispose: row.dispose,
      }),
    },
    buffer: { capacity: 10, maxAge: 60_000 },
    dedupe: { window: 1_000, maxKeys: 100 },
    timeout: 5_000,
    now: () => Date.now(),
    currentGeneration: () => 0,
    readAmbient: () => ({ generation: 0, user: null, tags: {}, contexts: {} }),
    submitDepth: { enter: () => {}, exit: () => {} },
    record: () => {},
    changed: () => {},
  });

  runtime.start();

  expect(() => runtime.dispose()).not.toThrow();
  await new Promise((resolve) => setTimeout(resolve, 10));
  process.off("unhandledRejection", unhandled);

  expect(unhandled).not.toHaveBeenCalled();
  expect(runtime.status.get()).toEqual({ state: "disposed" });
});

test("flush says not-ready before start and unsupported where the adapter has no flush", async () => {
  const idle = create();
  const bare = create();

  bare.runtime.start();

  await expect(idle.runtime.flush(100)).resolves.toEqual({
    drained: false,
    boundary: { status: "not-ready" },
  });
  await expect(bare.runtime.flush(100)).resolves.toEqual({
    drained: true,
    boundary: { status: "unsupported" },
  });
});

test("flush waits for work accepted before the call and not for work accepted after", async () => {
  const { mock, runtime, accept } = create({ hold: true, flush: true });

  runtime.start();
  accept("before");

  const flushed = runtime.flush(1_000);

  accept("after");
  mock.submissions[0]?.settle();

  await expect(flushed).resolves.toEqual({
    drained: true,
    boundary: { status: "flushed" },
  });
  expect(runtime.inFlight).toBe(1);
  expect(mock.sessions[0]?.flushes).toHaveLength(1);
});

test("a flush that runs out of time says timeout and never claims the work was lost", async () => {
  vi.useFakeTimers();

  const { runtime, accept } = create({ hold: true, flush: true });

  runtime.start();
  accept("stuck");

  const flushed = runtime.flush(200);

  await vi.advanceTimersByTimeAsync(200);

  await expect(flushed).resolves.toEqual({
    drained: false,
    boundary: { status: "timeout" },
  });
});

test("a held provider flush is bounded by the same timeout", async () => {
  vi.useFakeTimers();

  const { mock, runtime } = create({ flush: "hold" });

  runtime.start();

  const flushed = runtime.flush(200);

  await vi.advanceTimersByTimeAsync(200);

  await expect(flushed).resolves.toEqual({
    drained: true,
    boundary: { status: "timeout" },
  });
  expect(mock.sessions[0]?.flushes[0]?.context.signal.aborted).toBe(true);
});

test("ambient state is pushed when the destination becomes ready and whenever asked", () => {
  const { mock, runtime } = create({ ambient: true });

  runtime.start();

  runtime.syncAmbient({
    generation: 8,
    user: { id: "ada" },
    tags: {},
    contexts: {},
  });
  runtime.ambientBreadcrumb({ name: "opened", data: null, timestamp: 1 });

  expect(mock.sessions[0]?.ambient).toEqual({
    sessions: [
      { generation: 7, user: null, tags: {}, contexts: {} },
      { generation: 8, user: { id: "ada" }, tags: {}, contexts: {} },
    ],
    breadcrumbs: [{ name: "opened", data: null, timestamp: 1 }],
  });
});

test("methods stay bound when passed around", () => {
  const { runtime } = create();
  const { start, status } = runtime;

  start();

  expect(status.get()).toEqual({ state: "ready" });
});
