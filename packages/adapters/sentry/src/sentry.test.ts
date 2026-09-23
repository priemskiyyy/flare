import { Flare } from "@priemskiyyy/flare";
import { expect, test } from "vitest";

import { fakeSentry } from "src/fakeSentry.fixture";
import { sentry } from "src/sentry";

const create = (
  options: Partial<Parameters<typeof sentry>[0]> = {},
  fake = fakeSentry(),
) => {
  const flare = new Flare({
    destinations: { sentry: sentry({ sdk: fake.sdk, ...options }) },
  });

  return { fake, flare };
};

const capturedException = (fake: ReturnType<typeof fakeSentry>) => {
  const event = fake.events[0];

  if (event?.kind !== "exception") {
    throw new Error("Expected Sentry to capture an exception.");
  }

  return event.exception;
};

const untouched = {
  user: null,
  level: null,
  tags: {},
  contexts: {},
  breadcrumbs: [],
  transactionName: null,
};

test("prototype-named report metadata remains own event data", () => {
  const { fake, flare } = create();

  flare.start();
  flare.tag("__proto__", "tag value");
  flare.context("__proto__", { value: "context value" });
  flare.message("metadata");

  const scope = fake.events[0]?.scope;

  expect(Object.hasOwn(scope?.tags ?? {}, "__proto__")).toBe(true);
  expect(scope?.tags["__proto__"]).toBe("tag value");
  expect(JSON.stringify(scope?.contexts)).toBe(
    '{"__proto__":{"value":"context value"}}',
  );
});

test("creating the adapter calls nothing on the SDK", () => {
  const fake = fakeSentry({ initialized: false });

  sentry({ sdk: fake.sdk });

  expect(fake.calls).toEqual({ init: 0, flush: [] });
  expect(fake.events).toEqual([]);
});

test("an exception reaches Sentry as an Error rebuilt from the sanitized report", async () => {
  const { fake, flare } = create();

  flare.start();
  class UploadError extends Error {
    override name = "UploadError";
  }

  const thrown = new UploadError("upload failed");

  const status = await flare.capture(thrown).settled;

  const exception = capturedException(fake);

  expect(exception).toBeInstanceOf(Error);
  expect(exception).not.toBe(thrown);
  expect(exception).toMatchObject({
    name: "UploadError",
    message: "upload failed",
    stack: thrown.stack,
  });
  expect(status).toEqual({
    state: "settled",
    outcomes: {
      sentry: {
        status: "submitted",
        evidence: "sdk-call-returned",
        event: { id: "evt_1" },
        losses: [],
      },
    },
  });
});

test("the cause chain is rebuilt so Sentry can link the errors", () => {
  const { fake, flare } = create();

  flare.start();

  flare.capture(
    new Error("upload failed", {
      cause: new Error("write failed", { cause: "disk full" }),
    }),
  );

  expect(capturedException(fake)).toMatchObject({
    message: "upload failed",
    cause: {
      message: "write failed",
      cause: { name: "NonError", message: "disk full" },
    },
  });
});

test("a thrown value without a stack gets a header only, never frames that point into the adapter", () => {
  const { fake, flare } = create();

  flare.start();

  flare.capture("string rejection");

  expect(capturedException(fake)).toMatchObject({
    name: "NonError",
    stack: "NonError: string rejection",
  });
});

test("user, tags, contexts, breadcrumbs, level and operation are applied to a forked scope", () => {
  const { fake, flare } = create();

  flare.start();
  flare.user({ id: "ada", email: "ada@example.com", name: "Ada" });
  flare.breadcrumb("uploadStarted", { kind: "avatar" });

  const receipt = flare.capture(new Error("boom"), {
    tags: { area: "upload", attempt: 2 },
    contexts: { upload: { kind: "avatar" } },
    operation: "upload-avatar",
    level: "fatal",
  });

  expect(fake.events[0]?.scope).toEqual({
    user: { id: "ada", email: "ada@example.com", username: "Ada" },
    level: "fatal",
    tags: { area: "upload", attempt: 2, "flare.report_id": receipt.id },
    contexts: { upload: { kind: "avatar" } },
    breadcrumbs: [
      {
        category: "flare",
        message: "uploadStarted",
        data: { kind: "avatar" },
        level: "info",
        timestamp: expect.any(Number),
      },
    ],
    transactionName: "upload-avatar",
  });
});

test("breadcrumb time is converted to the seconds Sentry expects", () => {
  const fake = fakeSentry();

  const flare = new Flare({
    destinations: { sentry: sentry({ sdk: fake.sdk }) },
    now: () => 1_767_225_600_500,
  });

  flare.start();
  flare.breadcrumb("opened");

  flare.capture(new Error("boom"));

  expect(fake.events[0]?.scope.breadcrumbs).toMatchObject([
    { timestamp: 1_767_225_600.5 },
  ]);
});

test("submit never touches the scope that provider-owned events are sent with", () => {
  const { fake, flare } = create();

  flare.start();
  flare.user({ id: "ada" });
  flare.tag("plan", "pro");
  flare.context("workspace", { id: "w1" });
  flare.breadcrumb("opened");

  flare.capture(new Error("boom"), {
    tags: { area: "upload" },
    operation: "upload",
  });
  flare.message("note", { level: "warning" });

  expect(fake.events).toHaveLength(2);
  expect(fake.global).toEqual(untouched);
});

test("concurrent reports for different accounts never share a scope", () => {
  const { fake, flare } = create();

  flare.start();

  flare.capture(new Error("as ada"), {
    user: { id: "ada" },
    tags: { owner: "ada" },
  });
  flare.capture(new Error("as grace"), { user: { id: "grace" } });
  flare.capture(new Error("anonymous"));

  expect(
    fake.events.map((event) => [event.scope.user, event.scope.tags.owner]),
  ).toEqual([
    [{ id: "ada" }, "ada"],
    [{ id: "grace" }, undefined],
    [{}, undefined],
  ]);
});

test("a report Flare says is anonymous does not inherit the user on Sentry's global scope", () => {
  const { fake, flare } = create();

  flare.start();
  // The application, or a previous session, left a user on the global scope.
  fake.sdk.setUser({ id: "left-behind" });

  flare.capture(new Error("after logout"));

  expect(fake.events[0]?.scope.user).toEqual({});
  expect(fake.global.user).toEqual({ id: "left-behind" });
});

test("a message is a Sentry message with its level, not a fake exception", () => {
  const { fake, flare } = create();

  flare.start();

  flare.message("Unexpected payment state", { level: "warning" });

  expect(fake.events[0]).toMatchObject({
    kind: "message",
    message: "Unexpected payment state",
    scope: { level: "warning" },
  });
});

test("aggregated errors travel as a context, since Sentry has no field for them", () => {
  const { fake, flare } = create();

  flare.start();

  flare.capture(
    new AggregateError([new Error("one"), new Error("two")], "several failed"),
  );

  expect(fake.events[0]?.scope.contexts).toEqual({
    "flare.aggregated": {
      errors: [
        { name: "Error", message: "one" },
        { name: "Error", message: "two" },
      ],
    },
  });
});

test("tags Sentry would cut or refuse are reported as losses", async () => {
  const { flare } = create();

  flare.start();

  const longKey = "k".repeat(33);

  const status = await flare.capture(new Error("boom"), {
    tags: { [longKey]: "fits", note: "v".repeat(201), area: "upload" },
  }).settled;

  expect(status).toMatchObject({
    outcomes: {
      sentry: {
        losses: [
          { path: `tags.${longKey}`, reason: "truncated" },
          { path: "tags.note", reason: "truncated" },
        ],
      },
    },
  });
});

test("metadata replaced by Flare's report id and aggregate errors is reported as a loss", async () => {
  const { fake, flare } = create();

  flare.start();

  const receipt = flare.capture(
    new AggregateError([new Error("one")], "several failed"),
    {
      tags: { "flare.report_id": "wrong" },
      contexts: { "flare.aggregated": { errors: "wrong" } },
    },
  );

  await expect(receipt.settled).resolves.toMatchObject({
    outcomes: {
      sentry: {
        losses: [
          { path: "tags.flare.report_id", reason: "unsupported" },
          { path: "contexts.flare.aggregated", reason: "unsupported" },
        ],
      },
    },
  });
  expect(fake.events[0]?.scope.tags["flare.report_id"]).toBe(receipt.id);
  expect(fake.events[0]?.scope.contexts["flare.aggregated"]).toEqual({
    errors: [{ name: "Error", message: "one" }],
  });
});

test("an SDK that is not initialized yet fails the start, and a retry after the application initializes it succeeds", () => {
  const fake = fakeSentry({ initialized: false });
  const { flare } = create({}, fake);
  const receipt = flare.message("captured before init");

  flare.start();

  expect(flare.destination("sentry").status.get()).toMatchObject({
    state: "failed",
    error: expect.objectContaining({
      name: "FlareError",
      code: "NOT_INITIALIZED",
      message:
        "Sentry is not initialized. Call Sentry.init before flare.start().",
    }),
  });
  expect(fake.calls.init).toBe(0);

  fake.init();
  flare.start();

  expect(flare.destination("sentry").status.get()).toEqual({ state: "ready" });
  expect(receipt.status.get()).toMatchObject({
    outcomes: { sentry: { status: "submitted" } },
  });
});

test("flush waits for the SDK's queue and reports a timeout honestly", async () => {
  const fake = fakeSentry();

  // The SDK gets what is left of the timeout, so the clock stands still.
  const flare = new Flare({
    destinations: { sentry: sentry({ sdk: fake.sdk }) },
    now: () => 0,
  });

  flare.start();

  await expect(flare.flush({ timeout: 300 })).resolves.toEqual({
    drained: true,
    destinations: { sentry: { status: "flushed" } },
  });

  fake.state.flushAnswer = false;

  await expect(flare.flush({ timeout: 300 })).resolves.toEqual({
    drained: true,
    destinations: { sentry: { status: "timeout" } },
  });
  expect(fake.calls.flush).toEqual([300, 300]);
});

test("in the browser, a capture that throws is a failed outcome carrying the SDK's own error", async () => {
  const { fake, flare } = create();

  flare.start();
  fake.state.captureFailure = new Error("transport exploded");

  await expect(flare.capture(new Error("boom")).settled).resolves.toEqual({
    state: "settled",
    outcomes: {
      sentry: { status: "failed", error: fake.state.captureFailure },
    },
  });
});

test("on React Native, whose withScope swallows what its callback throws, a capture that throws is failed and never submitted", async () => {
  const { fake, flare } = create({}, fakeSentry({ platform: "react-native" }));

  flare.start();
  fake.state.captureFailure = new Error("native bridge exploded");

  const status = await flare.message("lost inside the scope").settled;

  expect(status).toEqual({
    state: "settled",
    outcomes: {
      sentry: {
        status: "failed",
        error: expect.objectContaining({
          name: "FlareError",
          code: "SUBMISSION_FAILED",
          message:
            "Sentry React Native swallowed an error while capturing the report.",
        }),
      },
    },
  });
  expect(fake.events).toEqual([]);
});

test("the native handle is the SDK the application injected", () => {
  const { fake, flare } = create();

  flare.start();

  expect(flare.destination("sentry").native).toBe(fake.sdk);
});
