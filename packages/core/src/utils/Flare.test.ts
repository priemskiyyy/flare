import { afterEach, expect, test, vi } from "vitest";

import { createMockAdapter } from "src/mock/createMockAdapter";
import type { MappingLoss } from "src/types/MappingLoss";
import type { Receipt } from "src/types/Receipt";
import type { StandardSchema } from "src/types/StandardSchema";
import type { SubmissionResult } from "src/types/SubmissionResult";
import { Flare } from "src/utils/Flare";

// Accepts only "upload", from any string, so a test can type an invalid value.
const uploadArea: StandardSchema<string, "upload"> = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) => {
      if (value === "upload") {
        return { value };
      }

      return { issues: [{ message: "unknown area" }] };
    },
  },
};

const rejectEverything: StandardSchema<Record<string, unknown>> = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: () => ({ issues: [{ message: "rejected" }] }),
  },
};

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

  expect(mock.sessions).toEqual([]);
  expect(vi.getTimerCount()).toBe(0);
  expect(flare.status.get()).toEqual({ state: "idle" });
  expect(flare.destination("primary").status.get()).toEqual({ state: "idle" });
});

test("an observed runtime status cannot prevent startup or revive disposal", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  Reflect.set(flare.status.get(), "state", "disposed");
  flare.start();
  expect(mock.sessions).toHaveLength(1);

  Reflect.set(flare.status.get(), "state", "disposed");
  expect(flare.message("running").status.get().state).toBe("settled");

  flare.dispose();
  Reflect.set(flare.status.get(), "state", "started");
  expect(flare.message("after disposal").status.get()).toEqual({
    state: "dropped",
    reason: "disposed",
  });
});

test("start opens every destination once, however often it is called", () => {
  const first = createMockAdapter();
  const second = createMockAdapter();

  const flare = new Flare({
    destinations: { first: first.adapter, second: second.adapter },
  });

  flare.start();
  flare.start();

  expect(first.sessions).toHaveLength(1);
  expect(second.sessions).toHaveLength(1);
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

test.each([
  ["returned", (answer: SubmissionResult) => answer],
  ["resolved", (answer: SubmissionResult) => Promise.resolve(answer)],
])(
  "an answer that throws when it is read is a failed outcome, never a throw into the application, when %s",
  async (_, deliver) => {
    const failure = new Error("unreadable losses");

    const answer: SubmissionResult = {
      status: "submitted",
      evidence: "sdk-call-returned",
      get losses(): readonly MappingLoss[] {
        throw failure;
      },
    };

    const flare = new Flare({
      destinations: {
        primary: {
          name: "unreadable",
          open: () => ({
            native: null,
            submit: () => deliver(answer),
          }),
        },
      },
    });

    flare.start();

    const receipts: Receipt<"primary">[] = [];

    expect(() => {
      receipts.push(flare.capture(new Error("boom")));
    }).not.toThrow();

    await expect(receipts[0]?.settled).resolves.toEqual({
      state: "settled",
      outcomes: { primary: { status: "failed", error: failure } },
    });
  },
);

test("an answer whose then throws when it is read is a failed outcome, never a throw into the application", async () => {
  const failure = new Error("unreadable then");

  const answer: SubmissionResult = Object.defineProperty(
    { status: "submitted", evidence: "sdk-call-returned" },
    "then",
    {
      get: () => {
        throw failure;
      },
    },
  );

  const flare = new Flare({
    destinations: {
      primary: {
        name: "hostile",
        open: () => ({ native: null, submit: () => answer }),
      },
    },
  });

  flare.start();

  const receipts: Receipt<"primary">[] = [];

  expect(() => {
    receipts.push(flare.capture(new Error("boom")));
  }).not.toThrow();

  await expect(receipts[0]?.settled).resolves.toEqual({
    state: "settled",
    outcomes: { primary: { status: "failed", error: failure } },
  });
});

test("defaults that are invalid fail the construction, since misconfiguration is the one thing Flare throws for", () => {
  expect(
    () =>
      new Flare({
        destinations: { primary: createMockAdapter().adapter },
        schema: { tags: { area: uploadArea } },
        defaults: { tags: { area: "billing" } },
      }),
  ).toThrow(
    expect.objectContaining({
      name: "FlareError",
      code: "INVALID_CONFIGURATION",
      message: "Flare's defaults are invalid at tags.area.",
    }),
  );
});

test("report data is made of ordinary objects that every provider SDK accepts, with every key its own", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();
  flare.breadcrumb("opened", { screen: { name: "cart" } });

  flare.capture(new Error("boom"), {
    tags: { area: "upload" },
    contexts: {
      upload: { kind: "avatar", nested: { size: 3 } },
      box: { ["__proto__"]: "an own key" },
    },
  });

  const report = mock.submissions[0]?.report;
  const upload = report?.contexts.upload;
  const box = report?.contexts.box;

  expect(Object.getPrototypeOf(report?.tags)).toBe(Object.prototype);
  expect(Object.getPrototypeOf(upload)).toBe(Object.prototype);
  expect(Object.getPrototypeOf(upload?.nested)).toBe(Object.prototype);
  expect(Object.getPrototypeOf(report?.breadcrumbs[0]?.data)).toBe(
    Object.prototype,
  );
  expect(Object.getPrototypeOf(box)).toBe(Object.prototype);
  expect(box !== undefined && Object.hasOwn(box, "__proto__")).toBe(true);
});

test("a tag or context its schema rejects stores nothing, even under a name that Object.prototype also has", async () => {
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    schema: {
      tags: { toString: uploadArea },
      contexts: { valueOf: rejectEverything },
    },
  });

  flare.start();

  flare.tag("toString", "billing");
  flare.context("valueOf", { kind: "avatar" });

  const status = await flare.capture(new Error("boom")).settled;

  expect(status).toMatchObject({
    outcomes: { primary: { status: "submitted" } },
  });
  expect(mock.submissions[0]?.report.tags).toEqual({});
  expect(mock.submissions[0]?.report.contexts).toEqual({});
});

test("a session that set up nothing needs no dispose", () => {
  const types: string[] = [];

  const flare = new Flare({
    destinations: {
      primary: {
        name: "bare",
        open: () => ({
          native: null,
          submit: () => ({
            status: "submitted",
            evidence: "sdk-call-returned",
          }),
        }),
      },
    },
  });

  flare.diagnostics.events.subscribe((event) => types.push(event.type));
  flare.start();

  flare.dispose();

  expect(types).not.toContain("destination dispose failed");
  expect(flare.destination("primary").status.get()).toEqual({
    state: "disposed",
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
  expect(mock.sessions).toEqual([]);

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

  expect(mock.sessions).toHaveLength(1);
  expect(mock.sessions[0]?.disposeCount).toBe(1);
  expect(flare.status.get()).toEqual({ state: "disposed" });
  await expect(receipt.settled).resolves.toEqual({
    state: "dropped",
    reason: "disposed",
  });
});

test("disposal from inside an adapter's open releases the session it returns", () => {
  const mock = createMockAdapter({ onOpen: () => flare.dispose() });
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

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

test("a defaults.to list that names an unknown destination fails at construction, where a developer will see it", () => {
  const mock = createMockAdapter();

  expect(
    () =>
      new Flare({
        destinations: { primary: mock.adapter },
        defaults: { to: JSON.parse('["typo"]') },
      }),
  ).toThrow(
    expect.objectContaining({
      name: "FlareError",
      code: "INVALID_CONFIGURATION",
      message: 'Flare has no destination named "typo".',
    }),
  );
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

test("disposing from a ready observer releases the session before a buffered report reaches it", async () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  const { status } = flare.destination("primary");

  status.subscribe(() => {
    if (status.get().state === "ready") {
      flare.dispose();
    }
  });

  const receipt = flare.message("buffered");

  flare.start();

  expect(mock.submissions).toEqual([]);
  expect(mock.sessions[0]?.disposeCount).toBe(1);
  await expect(receipt.settled).resolves.toMatchObject({
    outcomes: { primary: { status: "dropped", reason: "disposed" } },
  });
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
