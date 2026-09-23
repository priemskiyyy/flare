import { Flare } from "@priemskiyyy/flare";
import type { FlareLevel } from "@priemskiyyy/flare";
import { expect, test } from "vitest";

import { datadogLogs } from "src/datadogLogs";
import { fakeDatadogLogs } from "src/fakeDatadogLogs.fixture";

const create = (fake = fakeDatadogLogs()) => {
  const flare = new Flare({
    destinations: { logs: datadogLogs({ sdk: fake.sdk }) },
    now: () => Date.UTC(2026, 8, 23, 12, 0, 0),
  });

  return { fake, flare };
};

test("creating the adapter calls nothing on the SDK", () => {
  const fake = fakeDatadogLogs({ initialized: false });

  datadogLogs({ sdk: fake.sdk });

  expect(fake.calls).toEqual({
    init: 0,
    getInitConfiguration: 0,
    getUser: 0,
    log: 0,
  });
});

test("Logs that was never initialized fails the start, and a retry after init succeeds", async () => {
  const { fake, flare } = create(fakeDatadogLogs({ initialized: false }));

  flare.start();

  const receipt = flare.capture(new Error("during boot"));

  expect(flare.destination("logs").status.get()).toEqual({
    state: "failed",
    error: expect.objectContaining({
      name: "FlareError",
      code: "NOT_INITIALIZED",
      message:
        "Datadog Logs is not initialized. Call datadogLogs.init before flare.start().",
    }),
  });
  expect(fake.calls.log).toBe(0);

  fake.sdk.init({ clientToken: "pub" });
  flare.start();

  await expect(receipt.settled).resolves.toMatchObject({
    outcomes: { logs: { status: "submitted" } },
  });
  expect(fake.logs).toHaveLength(1);
});

test("an exception is one log with its status, its error with causes, and the report under flare", async () => {
  const { fake, flare } = create();

  fake.sdk.setUser({ id: "ada", email: "ada@example.com" });
  flare.start();
  flare.user({ id: "ada" });
  flare.breadcrumb("opened", { screen: "cart" });

  const receipt = flare.capture(
    new TypeError("upload failed", { cause: new Error("disk full") }),
    {
      tags: { plan: "pro" },
      contexts: { upload: { kind: "avatar" } },
      operation: "upload-avatar",
      level: "fatal",
    },
  );

  const status = await receipt.settled;

  expect(fake.logs).toEqual([
    {
      message: "upload failed",
      status: "critical",
      origin: "logger",
      usr: { id: "ada", email: "ada@example.com" },
      error: {
        kind: "TypeError",
        message: "upload failed",
        stack: expect.stringContaining("TypeError: upload failed"),
        causes: [{ type: "Error", message: "disk full" }],
        handling: "handled",
      },
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
    },
  ]);
  expect(status).toEqual({
    state: "settled",
    outcomes: {
      logs: {
        status: "submitted",
        evidence: "sdk-call-returned",
        event: null,
        losses: [],
      },
    },
  });
});

test("a message is one log with the message, and no error", async () => {
  const { fake, flare } = create();

  flare.start();

  await flare.message("Payment state is unexpected", { level: "warning" })
    .settled;

  expect(fake.logs).toHaveLength(1);
  expect(fake.logs[0]).toMatchObject({
    message: "Payment state is unexpected",
    status: "warn",
    flare: { level: "warning" },
  });
  expect(fake.logs[0]).not.toHaveProperty("error");
});

const LEVEL_STATUSES: { level: FlareLevel; status: string }[] = [
  { level: "info", status: "info" },
  { level: "warning", status: "warn" },
  { level: "error", status: "error" },
  { level: "fatal", status: "critical" },
];

test.each(LEVEL_STATUSES)(
  "level $level is status $status",
  async ({ level, status }) => {
    const { fake, flare } = create();

    flare.start();

    await flare.message("note", { level }).settled;

    expect(fake.logs[0]?.status).toBe(status);
  },
);

test("an error without a message is logged by its name", async () => {
  const { fake, flare } = create();

  flare.start();

  await flare.capture(new Error("")).settled;

  expect(fake.logs[0]?.message).toBe("Error");
});

test("the application's global context sits beside the report's attributes, never inside them", async () => {
  const { fake, flare } = create();

  fake.sdk.setGlobalContextProperty("plan", "free");
  fake.sdk.setGlobalContextProperty("release", "1.2.0");
  flare.start();

  await flare.capture(new Error("boom"), { tags: { plan: "pro" } }).settled;

  expect(fake.logs[0]).toMatchObject({
    plan: "free",
    release: "1.2.0",
    flare: { tags: { plan: "pro" } },
  });
  expect(fake.state.globalContext).toEqual({ plan: "free", release: "1.2.0" });
});

test("the errors of an AggregateError travel under flare", async () => {
  const { fake, flare } = create();

  flare.start();

  await flare.capture(
    new AggregateError([new Error("one"), new Error("two")], "several failed"),
  ).settled;

  expect(fake.logs[0]).toMatchObject({
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

  expect(fake.logs[0]).toMatchObject({
    flare: { tags: { area: "upload" } },
  });
  expect(status).toMatchObject({
    outcomes: {
      logs: {
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
    outcomes: { logs: { status: "skipped", reason: "identity-mismatch" } },
  });
  expect(fake.calls.log).toBe(0);
});

test("a report buffered under one account is skipped once Datadog names the next one", async () => {
  const { fake, flare } = create();

  fake.sdk.setUser({ id: "ada" });
  flare.user({ id: "ada" });

  const receipt = flare.capture(new Error("captured as ada, before start"));

  fake.sdk.setUser({ id: "grace" });
  flare.user({ id: "grace" });
  flare.start();

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: { logs: { status: "skipped", reason: "identity-mismatch" } },
  });
  expect(fake.logs).toEqual([]);
});

test("a report for Datadog's user, and an anonymous one, are both sent", async () => {
  const { fake, flare } = create();

  flare.start();

  await flare.capture(new Error("anonymous")).settled;

  fake.sdk.setUser({ id: "ada" });
  flare.user({ id: "ada" });

  await flare.capture(new Error("as ada")).settled;

  expect(fake.logs.map((log) => log.usr)).toEqual([undefined, { id: "ada" }]);
});

test("concurrent reports never share attributes", async () => {
  const { fake, flare } = create();

  flare.start();

  flare.capture(new Error("first"), { tags: { owner: "ada" } });
  flare.capture(new Error("second"), { contexts: { cart: { items: 2 } } });
  await flare.flush();

  expect(fake.logs[0]).toMatchObject({
    flare: { tags: { owner: "ada" }, contexts: {} },
  });
  expect(fake.logs[1]).toMatchObject({
    flare: { tags: {}, contexts: { cart: { items: 2 } } },
  });
});

test("a log Datadog discards on its own still reads as submitted: the SDK answers nothing either way", async () => {
  const { fake, flare } = create();

  flare.start();
  fake.state.discard = true;

  await expect(flare.capture(new Error("boom")).settled).resolves.toMatchObject(
    {
      outcomes: {
        logs: { status: "submitted", evidence: "sdk-call-returned" },
      },
    },
  );
  expect(fake.logs).toEqual([]);
});

test("there is no flush: Logs sends its batches on its own schedule", async () => {
  const { flare } = create();

  flare.start();

  await expect(flare.flush()).resolves.toEqual({
    drained: true,
    destinations: { logs: { status: "unsupported" } },
  });
});

test("the native handle is datadogLogs, and disposing leaves its user and global context alone", () => {
  const { fake, flare } = create();

  fake.sdk.setUser({ id: "ada" });
  fake.sdk.setGlobalContextProperty("release", "1.2.0");
  flare.start();

  expect(flare.destination("logs").native).toBe(fake.sdk);

  flare.dispose();

  expect(fake.state.user).toEqual({ id: "ada" });
  expect(fake.state.globalContext).toEqual({ release: "1.2.0" });
});
