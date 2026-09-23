import { afterEach, expect, test, vi } from "vitest";

import { createMockAdapter } from "src/mock/createMockAdapter";
import { Flare } from "src/utils/Flare";

afterEach(() => {
  vi.useRealTimers();
});

const SUBMITTED = {
  status: "submitted",
  evidence: "sdk-call-returned",
  event: null,
  losses: [],
};

test("prototype-named destinations retain their receipts and flush results", async () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { ["__proto__"]: mock.adapter } });
  const receipt = flare.message("buffered");

  expect(JSON.stringify(receipt.status.get())).toBe(
    '{"state":"pending","outcomes":{"__proto__":null}}',
  );
  flare.start();

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: { ["__proto__"]: SUBMITTED },
  });
  expect(Object.hasOwn((await flare.flush()).destinations, "__proto__")).toBe(
    true,
  );
});

test("prototype-named tags and contexts remain own report fields", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();
  flare.tag("__proto__", "tag value");
  flare.context("__proto__", { value: "context value" });
  flare.message("named data");

  expect(JSON.stringify(mock.submissions[0]?.report.tags)).toBe(
    '{"__proto__":"tag value"}',
  );
  expect(JSON.stringify(mock.submissions[0]?.report.contexts)).toBe(
    '{"__proto__":{"value":"context value"}}',
  );
});

test("constructing a Flare is cold: nothing opens, no timer starts, no global is touched", () => {
  vi.useFakeTimers();

  const mock = createMockAdapter();

  const flare = new Flare({ destinations: { primary: mock.adapter } });

  expect(mock.openings).toEqual([]);
  expect(vi.getTimerCount()).toBe(0);
  expect(flare.status.get()).toEqual({ state: "idle" });
  expect(flare.destination("primary").status.get()).toEqual({ state: "idle" });
});

test("an observed runtime status cannot prevent startup or revive disposal", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  Reflect.set(flare.status.get(), "state", "disposed");
  flare.start();
  expect(mock.openings).toHaveLength(1);

  Reflect.set(flare.status.get(), "state", "disposed");
  expect(flare.message("running").status.get().state).toBe("settled");

  flare.dispose();
  Reflect.set(flare.status.get(), "state", "started");
  expect(flare.message("after disposal").status.get()).toEqual({
    state: "dropped",
    reason: "disposed",
  });
});

test("destination registration uses the same adapter that passed ownership validation", () => {
  const first = createMockAdapter();
  const second = createMockAdapter();
  let reads = 0;

  const flare = new Flare({
    destinations: {
      get first() {
        reads += 1;

        return reads === 1 ? first.adapter : second.adapter;
      },
      second: second.adapter,
    },
  });

  flare.start();
  flare.message("one report per destination");

  expect(first.submissions).toHaveLength(1);
  expect(second.submissions).toHaveLength(1);
  expect(reads).toBe(1);
});

test("start opens every destination once, however often it is called", () => {
  const first = createMockAdapter();
  const second = createMockAdapter();

  const flare = new Flare({
    destinations: { first: first.adapter, second: second.adapter },
  });

  flare.start();
  flare.start();

  expect(first.openings).toHaveLength(1);
  expect(second.openings).toHaveLength(1);
  expect(flare.status.get()).toEqual({ state: "started" });
});

test("starting again tells no status observer anything, because nothing changed", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  const listener = vi.fn();
  const events: string[] = [];

  flare.status.subscribe(listener);
  flare.diagnostics.events.subscribe((event) => events.push(event.type));

  flare.start();

  const started = flare.status.get();

  flare.start();

  expect(listener).toHaveBeenCalledTimes(1);
  expect(flare.status.get()).toBe(started);
  expect(events.filter((type) => type === "started")).toHaveLength(1);
});

test("a report captured before start is delivered once the destination is ready", async () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  const receipt = flare.capture(new Error("early"));

  expect(receipt.status.get()).toEqual({
    state: "pending",
    outcomes: { primary: null },
  });

  flare.start();

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: { primary: SUBMITTED },
  });
  expect(mock.submissions[0]?.report).toMatchObject({
    kind: "exception",
    exception: { message: "early" },
  });
});

test("capture is synchronous and its receipt never rejects, whatever the provider does", async () => {
  const failure = new Error("sdk threw");

  const mock = createMockAdapter({
    onSubmit: () => {
      throw failure;
    },
  });

  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  const receipt = flare.capture(new Error("boom"));

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: { primary: { status: "failed", error: failure } },
  });
});

test("a message is a real report, not a fake Error", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  flare.message("Unexpected payment state", { level: "warning" });

  expect(mock.submissions[0]?.report).toMatchObject({
    kind: "message",
    message: "Unexpected payment state",
    level: "warning",
  });
  expect(mock.submissions[0]?.report).not.toHaveProperty("exception");
});

test("the adapter receives frozen data and never the thrown value itself", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  const thrown = Object.assign(new Error("boom"), { secret: "token" });

  flare.capture(thrown);

  const report = mock.submissions[0]?.report;

  expect(Object.isFrozen(report)).toBe(true);
  expect(JSON.stringify(report)).not.toContain("token");
  expect(report).not.toHaveProperty("secret");
});

test("a failed start can be retried without losing what was captured meanwhile", () => {
  let attempts = 0;

  const mock = createMockAdapter({
    onOpen: () => {
      attempts += 1;

      if (attempts === 1) {
        throw new Error("init failed");
      }
    },
  });

  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  const receipt = flare.capture(new Error("during outage"));

  expect(flare.destination("primary").status.get()).toMatchObject({
    state: "failed",
  });

  flare.start();

  expect(flare.destination("primary").status.get()).toEqual({ state: "ready" });
  expect(receipt.status.get()).toEqual({
    state: "settled",
    outcomes: { primary: SUBMITTED },
  });
});

test("the destination handle is passive and typed by the adapter's native handle", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  const handle = flare.destination("primary");

  expect(handle.native).toBeNull();
  expect(handle.capabilities).toEqual(mock.adapter.capabilities);
  expect(mock.openings).toEqual([]);

  flare.start();

  expect(handle.native).toBe(mock.sessions[0]);
  expect(handle.native?.submissions).toEqual([]);
});

test("disposal is idempotent, releases every session, and later captures are dropped", async () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  flare.dispose();
  flare.dispose();
  flare.start();

  const receipt = flare.capture(new Error("after dispose"));

  expect(mock.sessions[0]?.disposeCount).toBe(1);
  expect(mock.openings).toHaveLength(1);
  expect(flare.status.get()).toEqual({ state: "disposed" });
  await expect(receipt.settled).resolves.toEqual({
    state: "dropped",
    reason: "disposed",
  });
});

test("disposal during a slow start releases the session when it finally arrives", async () => {
  const mock = createMockAdapter({ holdOpen: true });
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  flare.dispose();
  mock.openings[0]?.settle();
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(mock.sessions[0]?.disposeCount).toBe(1);
  expect(flare.destination("primary").status.get()).toEqual({
    state: "disposed",
  });
});

test("disposal during a submission settles its receipt as indeterminate", async () => {
  const mock = createMockAdapter({ hold: true });
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  const receipt = flare.capture(new Error("in flight"));

  flare.dispose();

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: { primary: { status: "indeterminate", reason: "disposed" } },
  });
});

test("setters after disposal are silent", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.dispose();

  expect(() => {
    flare.user({ id: "ada" });
    flare.tag("area", "upload");
    flare.context("upload", { attempt: 1 });
    flare.breadcrumb("opened");
  }).not.toThrow();
});

test("methods stay bound when passed around", () => {
  const mock = createMockAdapter();

  const { start, capture, tag } = new Flare({
    destinations: { primary: mock.adapter },
  });

  start();
  tag("area", "upload");
  capture(new Error("bound"));

  expect(mock.submissions[0]?.report.tags).toEqual({ area: "upload" });
});

test("a misconfigured Flare fails at construction, where a developer will see it", () => {
  const mock = createMockAdapter();
  const both = JSON.parse("{}");

  expect(
    () =>
      new Flare({
        destinations: { primary: mock.adapter },
        ...both,
        default: ["primary"],
        route: () => ["primary"],
      }),
  ).toThrow("Flare accepts either default or route, not both.");
  expect(
    () =>
      new Flare({
        destinations: { primary: mock.adapter },
        default: JSON.parse('["typo"]'),
      }),
  ).toThrow('Flare has no destination named "typo".');
  expect(
    () =>
      new Flare({
        destinations: { first: mock.adapter, second: mock.adapter },
      }),
  ).toThrow(
    'Flare destinations "first" and "second" share one adapter. Create one adapter per destination.',
  );
});

test("default routing uses the names read and validated at construction", () => {
  const mock = createMockAdapter();
  const selected: "primary"[] = ["primary"];

  const readName = vi
    .fn()
    .mockReturnValueOnce("primary")
    .mockReturnValue("typo");

  Object.defineProperty(selected, "0", { get: readName });

  const readDefault = vi.fn(() => selected);
  const readRoute = vi.fn(() => undefined);

  const options = Object.defineProperties(
    { destinations: { primary: mock.adapter } },
    { default: { get: readDefault }, route: { get: readRoute } },
  );

  const flare = new Flare(options);

  flare.start();

  const receipt = flare.message("Request failed");

  expect(receipt.status.get()).toMatchObject({ state: "settled" });
  expect(mock.submissions).toHaveLength(1);
  expect(readDefault).toHaveBeenCalledTimes(1);
  expect(readRoute).toHaveBeenCalledTimes(1);
  expect(readName).toHaveBeenCalledTimes(1);
  flare.dispose();
});

test("two destinations that drive the same singleton SDK are rejected before anything opens", () => {
  const sdk = { name: "process-wide sdk" };
  const first = { ...createMockAdapter().adapter, singleton: sdk };
  const second = { ...createMockAdapter().adapter, singleton: sdk };

  const other = {
    ...createMockAdapter().adapter,
    singleton: { name: "another sdk" },
  };

  expect(() => new Flare({ destinations: { first, second } })).toThrow(
    'Flare destinations "first" and "second" drive the same singleton SDK. Register it once.',
  );
  expect(() => new Flare({ destinations: { first, other } })).not.toThrow();
});

test("every report gets its own id", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  const first = flare.capture(new Error("one"));
  const second = flare.capture(new Error("two"));

  expect(first.id).not.toBe(second.id);
  expect(mock.submissions.map((submission) => submission.report.id)).toEqual([
    first.id,
    second.id,
  ]);
});

test("disposing from a starting observer prevents the adapter from opening", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  const { status } = flare.destination("primary");

  status.subscribe(() => {
    if (status.get().state === "starting") {
      flare.dispose();
    }
  });

  flare.start();

  expect(mock.openings).toEqual([]);
  expect(status.get()).toEqual({ state: "disposed" });
});

test("disposing while the startup buffer drains stops the remaining submissions", async () => {
  const mock = createMockAdapter({ onSubmit: () => flare.dispose() });
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  const first = flare.message("first");
  const second = flare.message("second");

  flare.start();

  expect(mock.submissions).toHaveLength(1);
  expect(mock.sessions[0]?.disposeCount).toBe(1);
  await expect(first.settled).resolves.toMatchObject({
    outcomes: { primary: { status: "indeterminate", reason: "disposed" } },
  });
  await expect(second.settled).resolves.toMatchObject({
    outcomes: { primary: { status: "dropped", reason: "disposed" } },
  });
});

test("disposing from the availability probe cannot revive the destination", () => {
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: {
      primary: {
        ...mock.adapter,
        available: () => {
          flare.dispose();

          return { available: true };
        },
      },
    },
  });

  flare.start();

  expect(mock.openings).toEqual([]);
  expect(flare.destination("primary").status.get()).toEqual({
    state: "disposed",
  });
});

test("disposing from a submission diagnostic prevents the provider call", async () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.diagnostics.events.subscribe((event) => {
    if (event.type === "destination submit") {
      flare.dispose();
    }
  });
  flare.start();

  const receipt = flare.message("stopped before submit");

  expect(mock.submissions).toEqual([]);
  await expect(receipt.settled).resolves.toMatchObject({
    outcomes: { primary: { status: "indeterminate", reason: "disposed" } },
  });
});
