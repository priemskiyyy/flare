import { Flare } from "@priemskiyyy/flare";
import type { FlareLevel } from "@priemskiyyy/flare";
import { expect, test } from "vitest";

import { fakeLogger } from "src/fakeLogger.fixture";
import { opentelemetry } from "src/opentelemetry";

const CAPTURED_AT = Date.UTC(2026, 8, 23, 12, 0, 0);

const create = (fake = fakeLogger()) => {
  const flare = new Flare({
    destinations: {
      otel: opentelemetry({ logger: fake.logger, forceFlush: fake.forceFlush }),
    },
    now: () => CAPTURED_AT,
  });

  return { fake, flare };
};

test("creating the adapter calls nothing on the logger", () => {
  const fake = fakeLogger();

  opentelemetry({ logger: fake.logger, forceFlush: fake.forceFlush });

  expect(fake.calls).toEqual({ emit: 0, forceFlush: 0 });
});

test("an exception is one log record with its severity, its exception, its user and the report's own attributes", async () => {
  const { fake, flare } = create();

  flare.start();
  flare.user({ id: "ada", email: "ada@example.com", name: "Ada Lovelace" });
  flare.breadcrumb("opened", { screen: "cart" });

  const thrown = new TypeError("upload failed", {
    cause: new Error("disk full"),
  });

  const receipt = flare.capture(thrown, {
    tags: { plan: "pro" },
    contexts: { upload: { kind: "avatar" } },
    operation: "upload-avatar",
    level: "fatal",
  });

  const status = await receipt.settled;

  expect(fake.emitted).toEqual([
    {
      timestamp: new Date(CAPTURED_AT),
      severityNumber: 21,
      severityText: "FATAL",
      body: "upload failed",
      attributes: {
        "exception.type": "TypeError",
        "exception.message": "upload failed",
        "exception.stacktrace": thrown.stack,
        "user.id": "ada",
        "user.email": "ada@example.com",
        "user.full_name": "Ada Lovelace",
        "flare.report_id": receipt.id,
        "flare.operation": "upload-avatar",
        "flare.tags": { plan: "pro" },
        "flare.contexts": { upload: { kind: "avatar" } },
        "flare.breadcrumbs": [
          {
            name: "opened",
            data: { screen: "cart" },
            timestamp: "2026-09-23T12:00:00.000Z",
          },
        ],
        "flare.causes": [
          {
            name: "Error",
            message: "disk full",
            stack: expect.stringContaining("Error: disk full"),
          },
        ],
      },
    },
  ]);
  expect(status).toEqual({
    state: "settled",
    outcomes: {
      otel: {
        status: "submitted",
        evidence: "sdk-call-returned",
        event: null,
        losses: [],
      },
    },
  });
});

test("a message is one log record whose body is the message, with no exception", async () => {
  const { fake, flare } = create();

  flare.start();

  await flare.message("Payment state is unexpected", { level: "warning" })
    .settled;

  expect(fake.emitted).toHaveLength(1);
  expect(fake.emitted[0]).toMatchObject({
    severityNumber: 13,
    severityText: "WARN",
    body: "Payment state is unexpected",
  });
  expect(Object.keys(fake.emitted[0]?.attributes ?? {})).not.toContain(
    "exception.type",
  );
});

const LEVEL_SEVERITIES: {
  level: FlareLevel;
  severityNumber: number;
  severityText: string;
}[] = [
  { level: "info", severityNumber: 9, severityText: "INFO" },
  { level: "warning", severityNumber: 13, severityText: "WARN" },
  { level: "error", severityNumber: 17, severityText: "ERROR" },
  { level: "fatal", severityNumber: 21, severityText: "FATAL" },
];

test.each(LEVEL_SEVERITIES)(
  "level $level is severity $severityText",
  async ({ level, severityNumber, severityText }) => {
    const { fake, flare } = create();

    flare.start();

    await flare.message("note", { level }).settled;

    expect(fake.emitted[0]).toMatchObject({ severityNumber, severityText });
  },
);

test("a report keeps the user it was captured under, even when it waited through an account switch", async () => {
  const { fake, flare } = create();

  flare.user({ id: "ada" });

  const receipt = flare.capture(new Error("captured as ada, before start"));

  flare.user({ id: "grace" });
  flare.start();
  await receipt.settled;

  expect(fake.emitted[0]?.attributes).toMatchObject({ "user.id": "ada" });
});

test("an anonymous report carries no user", async () => {
  const { fake, flare } = create();

  flare.start();

  await flare.capture(new Error("anonymous")).settled;

  expect(fake.emitted).toHaveLength(1);
  expect(Object.keys(fake.emitted[0]?.attributes ?? {})).not.toContain(
    "user.id",
  );
});

test("a thrown value without a stack or a message is read by its name, with no stack trace", async () => {
  const { fake, flare } = create();

  flare.start();

  await flare.capture(new Error("")).settled;
  await flare.capture("string rejection").settled;

  expect(fake.emitted[0]?.body).toBe("Error");
  expect(fake.emitted[1]).toMatchObject({
    body: "string rejection",
    attributes: { "exception.type": "NonError" },
  });
  expect(Object.keys(fake.emitted[1]?.attributes ?? {})).not.toContain(
    "exception.stacktrace",
  );
});

test("the errors of an AggregateError travel as an attribute", async () => {
  const { fake, flare } = create();

  flare.start();

  await flare.capture(
    new AggregateError([new Error("one"), new Error("two")], "several failed"),
  ).settled;

  expect(fake.emitted[0]?.attributes).toMatchObject({
    "exception.type": "AggregateError",
    "flare.aggregated": [
      { name: "Error", message: "one" },
      { name: "Error", message: "two" },
    ],
  });
});

test("concurrent reports never share attributes", async () => {
  const { fake, flare } = create();

  flare.start();

  flare.capture(new Error("first"), { tags: { owner: "ada" } });
  flare.capture(new Error("second"), { contexts: { cart: { items: 2 } } });
  await flare.flush();

  expect(fake.exported[0]?.attributes).toMatchObject({
    "flare.tags": { owner: "ada" },
    "flare.contexts": {},
  });
  expect(fake.exported[1]?.attributes).toMatchObject({
    "flare.tags": {},
    "flare.contexts": { cart: { items: 2 } },
  });
});

test("flush exports what the processors hold, and a failed export is a failed flush", async () => {
  const { fake, flare } = create();

  flare.start();
  await flare.capture(new Error("boom")).settled;

  await expect(flare.flush()).resolves.toEqual({
    drained: true,
    destinations: { otel: { status: "flushed" } },
  });
  expect(fake.exported).toHaveLength(1);

  fake.state.flushFailure = new Error("the collector answered 503");

  await expect(flare.flush()).resolves.toEqual({
    drained: true,
    destinations: {
      otel: { status: "failed", error: fake.state.flushFailure },
    },
  });
});

test("without forceFlush there is no flush", async () => {
  const fake = fakeLogger();

  const flare = new Flare({
    destinations: { otel: opentelemetry({ logger: fake.logger }) },
  });

  flare.start();

  await expect(flare.flush()).resolves.toEqual({
    drained: true,
    destinations: { otel: { status: "unsupported" } },
  });
});

test("the native handle is the logger", () => {
  const { fake, flare } = create();

  flare.start();

  expect(flare.destination("otel").native).toBe(fake.logger);
});
