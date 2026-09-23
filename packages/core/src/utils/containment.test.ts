import { afterEach, expect, test, vi } from "vitest";

import { createMockAdapter } from "src/mock/createMockAdapter";
import type { ReporterAdapter } from "src/types/ReporterAdapter";
import type { SubmissionResult } from "src/types/SubmissionResult";
import { Flare } from "src/utils/Flare";

afterEach(() => {
  vi.useRealTimers();
});

// An adapter written in JavaScript can answer anything; these stand for that.
const answering = (answer: unknown): ReporterAdapter => ({
  name: "answering",
  open: () => ({
    native: null,
    // @ts-expect-error -- a JavaScript adapter's answer.
    submit: () => answer,
  }),
});

test("a level that is not one of the four is a loss, and the report keeps its default", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  const thrown = new Error("boom");

  flare.start();
  // @ts-expect-error -- a JavaScript caller can pass anything.
  flare.capture(thrown, { level: thrown });

  expect(mock.submissions[0]?.report).toMatchObject({
    level: "error",
    losses: [{ path: "level", reason: "invalid" }],
  });
});

test("an adapter answer with an unknown status is a failed outcome, never a throw", async () => {
  const flare = new Flare({
    destinations: { primary: answering({ status: "weird" }) },
  });

  flare.start();

  const receipt = flare.capture(new Error("boom"));

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: {
      primary: {
        status: "failed",
        error: expect.objectContaining({
          name: "FlareError",
          code: "INVALID_ANSWER",
        }),
      },
    },
  });
});

test("an unknown status answered asynchronously is a failed outcome too", async () => {
  const flare = new Flare({
    destinations: { primary: answering(Promise.resolve({ status: "weird" })) },
  });

  flare.start();

  await expect(flare.capture(new Error("boom")).settled).resolves.toMatchObject(
    { outcomes: { primary: { status: "failed" } } },
  );
});

test("an answer is published with its own fields only", async () => {
  const flare = new Flare({
    destinations: {
      primary: answering({
        status: "dropped",
        reason: "provider-filtered",
        raw: { secret: "provider internals" },
      }),
    },
  });

  flare.start();

  await expect(flare.capture(new Error("boom")).settled).resolves.toEqual({
    state: "settled",
    outcomes: { primary: { status: "dropped", reason: "provider-filtered" } },
  });
});

test("a malformed session is a failed start, and the next destination still opens", () => {
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: {
      // @ts-expect-error -- an open that returns nothing.
      broken: { name: "broken", open: () => undefined },
      unreadable: {
        name: "unreadable",
        open: () => ({
          get native(): never {
            throw new Error("unreadable native");
          },
          submit: (): SubmissionResult => ({
            status: "submitted",
            evidence: "sdk-call-returned",
          }),
        }),
      },
      primary: mock.adapter,
    },
  });

  expect(() => flare.start()).not.toThrow();
  expect(flare.destination("broken").status.get()).toMatchObject({
    state: "failed",
  });
  expect(flare.destination("unreadable").status.get()).toMatchObject({
    state: "failed",
  });
  expect(flare.destination("primary").status.get()).toEqual({
    state: "ready",
  });
});

test("starting again from inside open opens the destination once", () => {
  let opens = 0;
  let flare: Flare | null = null;

  const adapter: ReporterAdapter = {
    name: "reentrant",
    open: () => {
      opens += 1;
      flare?.start();

      return {
        native: null,
        submit: () => ({ status: "submitted", evidence: "sdk-call-returned" }),
      };
    },
  };

  flare = new Flare({ destinations: { primary: adapter } });
  flare.start();

  expect(opens).toBe(1);
  expect(flare.destination("primary").status.get()).toEqual({
    state: "ready",
  });
});

test("throwing getters on to and dedupe drop the report instead of throwing", () => {
  const flare = new Flare({
    destinations: { primary: createMockAdapter().adapter },
  });

  flare.start();

  const options = {
    get to(): never {
      throw new Error("unreadable route");
    },
  };

  expect(() => flare.capture(new Error("boom"), options)).not.toThrow();
  expect(flare.capture(new Error("boom"), options).status.get()).toEqual({
    state: "dropped",
    reason: "sanitizer-failed",
  });
  expect(
    flare
      .capture(new Error("boom"), {
        get dedupe(): never {
          throw new Error("unreadable dedupe");
        },
      })
      .status.get(),
  ).toEqual({ state: "dropped", reason: "sanitizer-failed" });
});

test("a scrubber that throws on the defaults is a FlareError that keeps the cause", () => {
  const failure = new Error("scrubber exploded");

  expect(
    () =>
      new Flare({
        destinations: { primary: createMockAdapter().adapter },
        defaults: { tags: { plan: "pro" } },
        privacy: {
          scrub: () => {
            throw failure;
          },
        },
      }),
  ).toThrow(
    expect.objectContaining({
      name: "FlareError",
      code: "INVALID_CONFIGURATION",
      cause: failure,
    }),
  );
});

test("a revoked proxy in metadata becomes a marker, and the report is sent", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  const { proxy, revoke } = Proxy.revocable({}, {});

  revoke();
  flare.start();
  flare.capture(new Error("boom"), { contexts: { upload: { file: proxy } } });

  expect(mock.submissions[0]?.report.contexts).toEqual({
    upload: { file: "[Unreadable]" },
  });
});

test("a clock that throws, or answers no number, falls back to the system clock", () => {
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    now: () => {
      throw new Error("clock exploded");
    },
  });

  flare.start();

  expect(() => flare.capture(new Error("boom"))).not.toThrow();
  expect(mock.submissions[0]?.report.timestamp).toBeGreaterThan(0);
});

test("replacing a method of a status Flare hands out changes nothing Flare reports", () => {
  const flare = new Flare({
    destinations: { primary: createMockAdapter().adapter },
  });

  Reflect.set(flare.destination("primary").status, "get", () => ({
    state: "ready",
  }));

  expect(flare.diagnostics.get().destinations[0]?.status).toEqual({
    state: "idle",
  });
});

test("a diagnostic event cannot be changed by the listener that receives it", () => {
  const flare = new Flare({
    destinations: { primary: createMockAdapter().adapter },
  });

  const contexts: unknown[] = [];

  flare.diagnostics.events.subscribe((event) => {
    contexts.push(event.context);
    expect(Object.isFrozen(event)).toBe(true);
  });

  flare.user({ id: "" });

  expect(contexts.length).toBeGreaterThan(0);

  for (const context of contexts) {
    expect(Object.isFrozen(context)).toBe(true);
  }
});

test("reports dropped as stale spend none of the rate budget", () => {
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    rateLimits: { perMinute: 2 },
  });

  flare.start();
  flare.user({ id: "ada" });

  const scope = flare.scope({ operation: "upload" });

  flare.user({ id: "grace" });
  scope.capture(new Error("stale one"));
  scope.capture(new Error("stale two"));

  expect(flare.capture(new Error("fresh")).status.get()).not.toMatchObject({
    state: "dropped",
  });
});

test("the last snapshot counts no receipt as pending once they were all settled by disposal", () => {
  const flare = new Flare({
    destinations: { primary: createMockAdapter({ hold: true }).adapter },
  });

  flare.start();
  flare.capture(new Error("in flight"));
  flare.dispose();

  expect(flare.diagnostics.get().pendingReceipts).toBe(0);
});

test("a report captured when a destination turns ready waits behind the ones buffered before it", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.capture(new Error("captured first, before start"));

  const status = flare.destination("primary").status;

  status.subscribe(() => {
    if (status.get().state === "ready") {
      flare.capture(new Error("captured second, on ready"));
    }
  });

  flare.start();

  expect(
    mock.submissions.map(({ report }) =>
      report.kind === "exception" ? report.exception.message : report.message,
    ),
  ).toEqual(["captured first, before start", "captured second, on ready"]);
});

test("a flush answer that is not one the contract allows is a failed flush", async () => {
  const flare = new Flare({
    destinations: {
      primary: {
        name: "flushing",
        open: () => ({
          native: null,
          submit: () => ({
            status: "submitted",
            evidence: "sdk-call-returned",
          }),
          // @ts-expect-error -- a JavaScript adapter's flush answer.
          flush: () => undefined,
        }),
      },
    },
  });

  flare.start();

  const result = await flare.flush();

  expect(result.destinations.primary).toMatchObject({
    status: "failed",
    error: expect.objectContaining({ code: "INVALID_ANSWER" }),
  });
  expect(Object.isFrozen(result.destinations)).toBe(true);
});

test("the rate window reopens after the clock steps back", () => {
  let clock = 3_600_000;
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    rateLimits: { perMinute: 1 },
    now: () => clock,
  });

  flare.start();
  flare.capture(new Error("admitted"));
  flare.capture(new Error("refused"));

  clock = 5 * 60_000;

  expect(flare.capture(new Error("a new window")).status.get()).not.toEqual({
    state: "dropped",
    reason: "rate-limited",
  });
});

test("a report buffered before the clock stepped back still expires within its age", async () => {
  vi.useFakeTimers();

  let clock = 10_000;

  const flare = new Flare({
    destinations: { primary: createMockAdapter().adapter },
    buffer: { maxAge: 1_000 },
    now: () => clock,
  });

  const receipt = flare.capture(new Error("buffered"));

  clock = 0;
  await vi.advanceTimersByTimeAsync(1_000);
  clock = 1_000;
  await vi.advanceTimersByTimeAsync(1_000);

  expect(receipt.status.get()).toEqual({
    state: "settled",
    outcomes: { primary: { status: "dropped", reason: "buffer-expired" } },
  });
});

test("a clock that steps back does not turn a later report into a duplicate", () => {
  let clock = 10_000;
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    now: () => clock,
  });

  const thrown = new Error("the same error");

  flare.start();
  flare.capture(thrown);
  clock = 0;
  flare.capture(thrown);

  expect(mock.submissions).toHaveLength(2);
});
