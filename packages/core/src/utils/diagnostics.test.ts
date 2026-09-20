import { afterEach, expect, test, vi } from "vitest";

import { createMockAdapter } from "src/mock/createMockAdapter";
import type { FlareDiagnosticEvent } from "src/types/FlareDiagnosticEvent";
import { isRecord } from "src/utils/common/isRecord";
import { Flare } from "src/utils/Flare";

afterEach(() => {
  vi.useRealTimers();
});

const outcomesOf = (events: FlareDiagnosticEvent[]) =>
  events
    .filter((event) => event.type === "destination outcome")
    .map((event) => [event.destination, event.context]);

test("observing diagnostics is passive: it opens nothing and creates no report", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.diagnostics.subscribe(() => {});
  flare.diagnostics.events.subscribe(() => {});
  flare.diagnostics.get();
  flare.status.subscribe(() => {});
  flare.destination("primary").status.subscribe(() => {});

  expect(mock.openings).toEqual([]);
  expect(mock.submissions).toEqual([]);
});

test("the snapshot holds counts and statuses, never report content", () => {
  const mock = createMockAdapter({ name: "mocked", hold: true });
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  flare.user({ id: "ada" });
  flare.breadcrumb("opened");
  flare.capture(new Error("buffered"));

  expect(flare.diagnostics.get()).toEqual({
    status: { state: "idle" },
    generation: 1,
    breadcrumbs: 1,
    pendingReceipts: 1,
    destinations: [
      {
        name: "primary",
        adapter: "mocked",
        status: { state: "idle" },
        capabilities: mock.adapter.capabilities,
        buffered: 1,
        inFlight: 0,
      },
    ],
  });

  flare.start();

  expect(flare.diagnostics.get().destinations[0]).toMatchObject({
    buffered: 0,
    inFlight: 1,
  });
});

test.each(["destination", "diagnostics"])(
  "%s observers cannot change the capabilities used for submission",
  (view) => {
    const mock = createMockAdapter();
    const flare = new Flare({ destinations: { primary: mock.adapter } });
    flare.start();
    const capabilities =
      view === "destination"
        ? flare.destination("primary").capabilities
        : flare.diagnostics.get().destinations[0]?.capabilities;
    if (capabilities === undefined) {
      throw new Error("The destination must expose its capabilities.");
    }

    Reflect.set(capabilities, "messages", false);
    Reflect.set(capabilities.eventLocal, "contexts", false);
    const receipt = flare.message("Request failed");

    expect(receipt.status.get()).toMatchObject({
      state: "settled",
      outcomes: { primary: { status: "submitted" } },
    });
    expect(mock.submissions).toHaveLength(1);
    expect(flare.destination("primary").capabilities.eventLocal.contexts).toBe(
      true,
    );
    expect(mock.adapter.capabilities.messages).toBe(true);
    flare.dispose();
  },
);

test("destinations own their capability snapshot without freezing adapter configuration", () => {
  const mock = createMockAdapter();
  const original = mock.adapter.capabilities;
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  const handle = flare.destination("primary");

  expect(Reflect.set(original, "messages", false)).toBe(true);
  expect(Reflect.set(original.eventLocal, "contexts", false)).toBe(true);
  flare.start();
  flare.message("Request failed");

  expect(mock.submissions).toHaveLength(1);
  expect(handle.capabilities.messages).toBe(true);
  expect(handle.capabilities.eventLocal.contexts).toBe(true);
  expect(flare.diagnostics.get().destinations[0]?.capabilities).toBe(
    handle.capabilities,
  );
  flare.dispose();
});

test.each(["active", "disposed"])(
  "an observer cannot rewrite the cached %s diagnostic snapshot",
  (state) => {
    const mock = createMockAdapter();
    const flare = new Flare({ destinations: { primary: mock.adapter } });
    if (state === "disposed") {
      flare.dispose();
    }
    const snapshot = flare.diagnostics.get();
    const expected = structuredClone(snapshot);

    Reflect.set(snapshot, "pendingReceipts", 42);
    for (const destination of snapshot.destinations) {
      Reflect.set(destination, "name", "changed");
      Reflect.set(destination, "buffered", 42);
    }
    Reflect.set(snapshot.destinations, "length", 0);

    expect(flare.diagnostics.get()).toBe(snapshot);
    expect(flare.diagnostics.get()).toEqual(expected);
    flare.dispose();
  },
);

test("the timeline names what happened to a report from acceptance to outcome", async () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  const events: FlareDiagnosticEvent[] = [];
  flare.diagnostics.events.subscribe((event) => events.push(event));
  flare.start();
  flare.user({ id: "ada" });

  const receipt = flare.capture(new Error("boom"));
  const stale = flare.scope({});
  flare.user(null);
  stale.capture(new Error("stale"));
  flare.dispose();

  expect(events.map((event) => event.type)).toEqual([
    "started",
    "destination starting",
    "destination ready",
    "identity changed",
    "report accepted",
    "destination submit",
    "destination outcome",
    "identity changed",
    "report dropped",
    "destination disposed",
    "disposed",
  ]);
  expect(
    events.find((event) => event.type === "report accepted"),
  ).toMatchObject({
    report: receipt.id,
    context: { kind: "exception", destinations: ["primary"] },
  });
  expect(
    events.find((event) => event.type === "report dropped")?.context,
  ).toEqual({
    reason: "stale-scope",
  });
});

test("pending receipts return to zero once reports settle", async () => {
  const mock = createMockAdapter({ hold: true });
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  flare.start();
  const receipt = flare.capture(new Error("boom"));

  expect(flare.diagnostics.get().pendingReceipts).toBe(1);

  mock.submissions[0]?.settle();
  await receipt.settled;
  await Promise.resolve();

  expect(flare.diagnostics.get().pendingReceipts).toBe(0);
});

test("a diagnostic listener cannot change the destinations a receipt waits for", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  flare.diagnostics.events.subscribe((event) => {
    if (!isRecord(event.context)) {
      return;
    }
    const { destinations } = event.context;
    if (event.type === "report accepted" && Array.isArray(destinations)) {
      destinations.push("unselected");
    }
  });
  flare.start();

  const receipt = flare.message("Request failed");

  expect(receipt.status.get()).toEqual({
    state: "settled",
    outcomes: {
      primary: {
        status: "submitted",
        evidence: "sdk-call-returned",
        event: null,
        losses: [],
      },
    },
  });
  flare.dispose();
});

test("every outcome a destination gives is announced, whichever path it took", async () => {
  vi.useFakeTimers();
  const ready = createMockAdapter({ capabilities: { messages: false } });
  const lossy = createMockAdapter({
    onSubmit: () => ({
      status: "submitted",
      evidence: "sdk-call-returned",
      event: null,
      losses: [{ path: "breadcrumbs", reason: "unsupported" }],
    }),
  });
  const failing = createMockAdapter({
    onSubmit: () => {
      throw new Error("sdk threw");
    },
  });
  const hanging = createMockAdapter({ hold: true });
  const unavailable = createMockAdapter({
    available: { available: false, reason: "not on this platform" },
  });
  const flare = new Flare({
    destinations: {
      ready: ready.adapter,
      lossy: lossy.adapter,
      failing: failing.adapter,
      hanging: hanging.adapter,
      unavailable: unavailable.adapter,
    },
    deadlineMs: 1_000,
  });
  const events: FlareDiagnosticEvent[] = [];
  flare.diagnostics.events.subscribe((event) => events.push(event));
  flare.start();
  const error = new Error("boom");

  flare.capture(error);
  flare.capture(error, { to: ["ready"] });
  flare.message("note", { to: ["ready"] });
  await vi.advanceTimersByTimeAsync(1_000);

  expect(outcomesOf(events)).toEqual([
    ["ready", { status: "submitted", reason: null, losses: 0 }],
    ["lossy", { status: "submitted", reason: null, losses: 1 }],
    ["failing", { status: "failed", reason: null, losses: 0 }],
    ["unavailable", { status: "skipped", reason: "unavailable", losses: 0 }],
    ["ready", { status: "dropped", reason: "deduped", losses: 0 }],
    [
      "ready",
      { status: "skipped", reason: "unsupported-report-kind", losses: 0 },
    ],
    ["hanging", { status: "indeterminate", reason: "deadline", losses: 0 }],
  ]);
});

test("what happens to a buffered report is announced too: held, overflowed, expired, submitted and disposed", async () => {
  vi.useFakeTimers();
  const mock = createMockAdapter();
  const flare = new Flare({
    destinations: { primary: mock.adapter },
    buffer: { maxReports: 1, maxAgeMs: 1_000 },
  });
  const events: FlareDiagnosticEvent[] = [];
  flare.diagnostics.events.subscribe((event) => events.push(event));

  const overflowed = flare.capture(new Error("pushed out"));
  const expired = flare.capture(new Error("grows old"));
  await vi.advanceTimersByTimeAsync(1_000);
  const submitted = flare.capture(new Error("waits for start"));
  flare.start();
  flare.dispose();

  const forReport = (id: string) =>
    events
      .filter((event) => event.report === id && event.source === "destination")
      .map((event) => [event.type, event.context]);
  expect(forReport(overflowed.id)).toEqual([
    ["report buffered", { buffered: 1 }],
    [
      "destination outcome",
      { status: "dropped", reason: "buffer-overflow", losses: 0 },
    ],
  ]);
  expect(forReport(expired.id)).toEqual([
    ["report buffered", { buffered: 1 }],
    [
      "destination outcome",
      { status: "dropped", reason: "buffer-expired", losses: 0 },
    ],
  ]);
  expect(forReport(submitted.id)).toEqual([
    ["report buffered", { buffered: 1 }],
    ["destination submit", null],
    ["destination outcome", { status: "submitted", reason: null, losses: 0 }],
  ]);
});

test("an event never carries an error object or report content, only its shape", () => {
  const secret = "sk_live_12345";
  const mock = createMockAdapter({
    onSubmit: () => {
      throw new Error(`provider echoed ${secret}`);
    },
  });
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  const events: FlareDiagnosticEvent[] = [];
  flare.diagnostics.events.subscribe((event) => events.push(event));
  flare.start();

  flare.capture(new Error("boom"), { tags: { note: secret } });

  expect(JSON.stringify(events)).not.toContain(secret);
  expect(JSON.stringify(flare.diagnostics.get())).not.toContain(secret);
});

test("a breadcrumb refused for belonging to a previous identity is announced", () => {
  let clock = 1_000;
  const mock = createMockAdapter();
  const flare = new Flare({
    destinations: { primary: mock.adapter },
    now: () => clock,
  });
  const events: FlareDiagnosticEvent[] = [];
  flare.diagnostics.events.subscribe((event) => events.push(event));
  flare.user({ id: "ada" });
  clock = 2_000;
  flare.user({ id: "grace" });

  flare.breadcrumb("ada-step", undefined, { timestamp: 1_500 });

  expect(events.at(-1)).toMatchObject({
    source: "session",
    type: "breadcrumb stale",
    context: { name: "ada-step" },
  });
});
