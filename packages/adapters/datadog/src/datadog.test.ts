import { Flare } from "@priemskiyyy/flare";
import { expect, test } from "vitest";

import { datadog } from "src/datadog";
import { fakeDatadogRum } from "src/fakeDatadogRum.fixture";

const create = (fake = fakeDatadogRum()) => {
  const flare = new Flare({
    destinations: { datadog: datadog({ sdk: fake.sdk }) },
  });

  return { fake, flare };
};

test("creating the adapter calls nothing on the SDK", () => {
  const fake = fakeDatadogRum({ initialized: false });

  datadog({ sdk: fake.sdk });

  expect(fake.calls).toEqual({
    init: 0,
    getInitConfiguration: 0,
    getUser: 0,
    addError: 0,
  });
});

test("RUM that was never initialized fails the start, and a retry after init succeeds", async () => {
  const { fake, flare } = create(fakeDatadogRum({ initialized: false }));

  flare.start();

  const receipt = flare.capture(new Error("during boot"));

  expect(flare.destination("datadog").status.get()).toEqual({
    state: "failed",
    error: expect.objectContaining({
      name: "FlareError",
      code: "NOT_INITIALIZED",
      message:
        "Datadog RUM is not initialized. Call datadogRum.init before flare.start().",
    }),
  });
  expect(fake.calls.addError).toBe(0);

  fake.sdk.init({ applicationId: "app" });
  flare.start();

  await expect(receipt.settled).resolves.toMatchObject({
    outcomes: { datadog: { status: "submitted" } },
  });
  expect(fake.errors).toHaveLength(1);
});

test("an exception is one RUM error with its causes, and the report travels under context.flare", async () => {
  const fake = fakeDatadogRum();

  const flare = new Flare({
    destinations: { datadog: datadog({ sdk: fake.sdk }) },
    now: () => Date.UTC(2026, 8, 23, 12, 0, 0),
  });

  flare.start();
  flare.tag("plan", "pro");
  flare.breadcrumb("opened", { screen: "cart" });

  const receipt = flare.capture(
    new TypeError("upload failed", { cause: new Error("disk full") }),
    {
      contexts: { upload: { kind: "avatar" } },
      operation: "upload-avatar",
      level: "fatal",
    },
  );

  const status = await receipt.settled;

  expect(fake.errors[0]?.error).toEqual({
    type: "TypeError",
    message: "upload failed",
    causes: [{ type: "Error", message: "disk full" }],
  });
  expect(fake.errors[0]?.context).toEqual({
    flare: {
      report_id: receipt.id,
      level: "fatal",
      operation: "upload-avatar",
      tags: { plan: "pro" },
      contexts: { upload: { kind: "avatar" } },
      breadcrumbs: [
        {
          name: "opened",
          data: { screen: "cart" },
          timestamp: "2026-09-23T12:00:00.000Z",
        },
      ],
    },
  });
  expect(status).toEqual({
    state: "settled",
    outcomes: {
      datadog: {
        status: "submitted",
        evidence: "sdk-call-returned",
        event: null,
        losses: [],
      },
    },
  });
});

test("the application's global context is merged beside the report's attributes, never into them", () => {
  const { fake, flare } = create();

  fake.sdk.setGlobalContextProperty("plan", "free");
  fake.sdk.setGlobalContextProperty("release", "1.2.0");
  flare.start();

  flare.capture(new Error("boom"), { tags: { plan: "pro" } });

  expect(fake.errors[0]?.context).toMatchObject({
    plan: "free",
    release: "1.2.0",
    flare: { tags: { plan: "pro" } },
  });
  expect(fake.state.globalContext).toEqual({ plan: "free", release: "1.2.0" });
});

test("the errors of an AggregateError travel under context.flare", () => {
  const { fake, flare } = create();

  flare.start();

  flare.capture(
    new AggregateError([new Error("one"), new Error("two")], "several failed"),
  );

  expect(fake.errors[0]?.context).toMatchObject({
    flare: {
      aggregated: [
        { name: "Error", message: "one" },
        { name: "Error", message: "two" },
      ],
    },
  });
});

test("a tag or context named __proto__ is a loss, because Datadog's merge drops that name", async () => {
  const { fake, flare } = create();

  flare.start();

  const status = await flare.capture(new Error("boom"), {
    tags: { ["__proto__"]: "tag", area: "upload" },
    contexts: { ["__proto__"]: { value: "context" } },
  }).settled;

  expect(fake.errors[0]?.context).toMatchObject({
    flare: { tags: { area: "upload" } },
  });
  expect(status).toMatchObject({
    outcomes: {
      datadog: {
        losses: [
          { path: "tags.__proto__", reason: "unsupported" },
          { path: "contexts.__proto__", reason: "unsupported" },
        ],
      },
    },
  });
});

test("a report whose user is not the user Datadog attaches is skipped, because Datadog would file it under that user", async () => {
  const { fake, flare } = create();

  fake.sdk.setUser({ id: "operator" });
  flare.start();
  flare.user({ id: "operator" });

  await expect(
    flare.capture(new Error("for a customer"), { user: { id: "customer-7" } })
      .settled,
  ).resolves.toEqual({
    state: "settled",
    outcomes: { datadog: { status: "skipped", reason: "identity-mismatch" } },
  });
  expect(fake.calls.addError).toBe(0);
});

test("a report buffered under one account is skipped once Datadog names the next one", async () => {
  const fake = fakeDatadogRum();

  const flare = new Flare({
    destinations: { datadog: datadog({ sdk: fake.sdk }) },
  });

  fake.sdk.setUser({ id: "ada" });
  flare.user({ id: "ada" });

  const receipt = flare.capture(new Error("captured as ada, before start"));

  fake.sdk.setUser({ id: "grace" });
  flare.user({ id: "grace" });
  flare.start();

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: { datadog: { status: "skipped", reason: "identity-mismatch" } },
  });
  expect(fake.errors).toEqual([]);
});

test("a report for Datadog's user, and an anonymous one, are both sent", () => {
  const { fake, flare } = create();

  flare.start();

  flare.capture(new Error("anonymous"));
  fake.sdk.setUser({ id: "ada", email: "ada@example.com" });
  flare.user({ id: "ada" });
  flare.capture(new Error("as ada"));

  expect(fake.errors.map((error) => error.usr)).toEqual([
    undefined,
    { id: "ada", email: "ada@example.com" },
  ]);
});

test("concurrent reports never share attributes", () => {
  const { fake, flare } = create();

  flare.start();

  flare.capture(new Error("first"), { tags: { owner: "ada" } });
  flare.capture(new Error("second"), { contexts: { cart: { items: 2 } } });

  expect(fake.errors[0]?.context).toMatchObject({
    flare: { tags: { owner: "ada" }, contexts: {} },
  });
  expect(fake.errors[1]?.context).toMatchObject({
    flare: { tags: {}, contexts: { cart: { items: 2 } } },
  });
  expect(fake.state.globalContext).toEqual({});
});

test("an error Datadog discards on its own still reads as submitted: the SDK answers nothing either way", async () => {
  const { fake, flare } = create();

  flare.start();
  fake.state.discard = true;

  await expect(flare.capture(new Error("boom")).settled).resolves.toMatchObject(
    {
      outcomes: {
        datadog: { status: "submitted", evidence: "sdk-call-returned" },
      },
    },
  );
  expect(fake.errors).toEqual([]);
});

test("a message is skipped, because RUM records errors and nothing else", async () => {
  const { fake, flare } = create();

  flare.start();

  await expect(
    flare.message("Unexpected payment state").settled,
  ).resolves.toEqual({
    state: "settled",
    outcomes: {
      datadog: { status: "skipped", reason: "unsupported-report-kind" },
    },
  });
  expect(fake.calls.addError).toBe(0);
});

test("there is no flush: RUM sends its batches on its own schedule", async () => {
  const { flare } = create();

  flare.start();

  await expect(flare.flush()).resolves.toEqual({
    drained: true,
    destinations: { datadog: { status: "unsupported" } },
  });
});

test("the native handle is datadogRum, and disposing leaves its user and global context alone", () => {
  const { fake, flare } = create();

  fake.sdk.setUser({ id: "ada" });
  fake.sdk.setGlobalContextProperty("release", "1.2.0");
  flare.start();

  expect(flare.destination("datadog").native).toBe(fake.sdk);

  flare.dispose();

  expect(fake.state.user).toEqual({ id: "ada" });
  expect(fake.state.globalContext).toEqual({ release: "1.2.0" });
});
