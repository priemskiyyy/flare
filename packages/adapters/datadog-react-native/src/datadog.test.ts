import { Flare } from "@priemskiyyy/flare";
import { expect, test } from "vitest";

import { datadog } from "src/datadog";
import { fakeDdRum } from "src/fakeDdRum.fixture";

const CAPTURED_AT = Date.UTC(2026, 8, 23, 12, 0, 0);

const create = (fake = fakeDdRum()) => {
  const flare = new Flare({
    destinations: { datadog: datadog({ sdk: fake.sdk }) },
    now: () => CAPTURED_AT,
  });

  return { fake, flare };
};

test("creating the adapter calls nothing on the SDK", () => {
  const fake = fakeDdRum();

  datadog({ sdk: fake.sdk });

  expect(fake.calls).toEqual({ addError: 0 });
});

test("an exception is one RUM error at its capture time, with its stack, and the report under flare", async () => {
  const { fake, flare } = create();

  flare.start();
  flare.breadcrumb("opened", { screen: "cart" });

  const thrown = new TypeError("upload failed", {
    cause: new Error("disk full"),
  });

  const receipt = flare.capture(thrown, {
    tags: { area: "upload" },
    operation: "upload-avatar",
    level: "warning",
  });

  const status = await receipt.settled;

  expect(fake.errors).toEqual([
    {
      message: "upload failed",
      source: "CUSTOM",
      stacktrace: thrown.stack,
      timestampMs: CAPTURED_AT,
      user: undefined,
      attributes: {
        "_dd.error.source_type": "react-native",
        "flare.report_id": receipt.id,
        "flare.level": "warning",
        "flare.operation": "upload-avatar",
        "flare.tags.area": "upload",
        "flare.breadcrumbs": [
          {
            name: "opened",
            "data.screen": "cart",
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
      datadog: {
        status: "submitted",
        evidence: "sdk-call-returned",
        event: null,
        losses: [],
      },
    },
  });
});

test("contexts reach the SDK as attributes, because the core's objects are ordinary ones and the SDK drops any other kind", async () => {
  const { fake, flare } = create();

  flare.start();

  await flare.capture(new Error("boom"), {
    contexts: { upload: { kind: "avatar", retry: { count: 2 } } },
  }).settled;

  expect(fake.errors[0]?.attributes).toMatchObject({
    "flare.contexts.upload.kind": "avatar",
    "flare.contexts.upload.retry.count": 2,
  });
});

test("the errors of an AggregateError travel under flare, beside the causes", async () => {
  const { fake, flare } = create();

  flare.start();

  await flare.capture(
    new AggregateError([new Error("one"), new Error("two")], "several failed"),
  ).settled;

  expect(fake.errors[0]?.attributes).toMatchObject({
    "flare.causes": [],
    "flare.aggregated": [
      { name: "Error", message: "one" },
      { name: "Error", message: "two" },
    ],
  });
});

test("a thrown value without a stack is recorded with a header that names it", async () => {
  const { fake, flare } = create();

  flare.start();

  await flare.capture("string rejection").settled;

  expect(fake.errors[0]).toMatchObject({
    message: "string rejection",
    stacktrace: "NonError: string rejection",
  });
});

test("the report's user is a loss: the SDK attaches the user it was given, which it does not reveal", async () => {
  const { fake, flare } = create();

  fake.setUserInfo({ id: "ada" });
  flare.start();
  flare.user({ id: "ada" });

  const status = await flare.capture(new Error("boom")).settled;

  expect(fake.errors[0]?.user).toEqual({ id: "ada" });
  expect(status).toMatchObject({
    outcomes: {
      datadog: {
        status: "submitted",
        losses: [{ path: "identity.user", reason: "unsupported" }],
      },
    },
  });
});

test("a report whose user was signed out since it was captured is skipped, because the SDK would file it under the next user", async () => {
  const { fake, flare } = create();

  flare.user({ id: "ada" });

  const receipt = flare.capture(new Error("captured as ada, before start"));

  flare.user({ id: "grace" });
  flare.start();

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: { datadog: { status: "skipped", reason: "identity-mismatch" } },
  });
  expect(fake.calls.addError).toBe(0);
});

test("an anonymous report buffered before a sign-in is sent", async () => {
  const { fake, flare } = create();
  const receipt = flare.capture(new Error("during boot"));

  flare.user({ id: "ada" });
  flare.start();

  await expect(receipt.settled).resolves.toMatchObject({
    outcomes: { datadog: { status: "submitted", losses: [] } },
  });
  expect(fake.errors).toHaveLength(1);
});

test("before the SDK is initialized, it keeps the error in its own buffer and records it once initialized", async () => {
  const { fake, flare } = create(fakeDdRum({ initialized: false }));

  flare.start();

  const status = await flare.capture(new Error("early")).settled;

  expect(status).toMatchObject({
    outcomes: { datadog: { status: "submitted" } },
  });
  expect(fake.errors).toEqual([]);

  await fake.initialize();

  expect(fake.errors).toMatchObject([{ message: "early" }]);
});

test("a native call that rejects is a failed outcome", async () => {
  const { fake, flare } = create();

  flare.start();
  fake.state.nativeFailure = new Error("bridge failed");

  await expect(flare.capture(new Error("boom")).settled).resolves.toEqual({
    state: "settled",
    outcomes: {
      datadog: { status: "failed", error: fake.state.nativeFailure },
    },
  });
});

test("an error the event mapper discards still reads as submitted: the SDK answers nothing either way", async () => {
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

test("there is no flush: the native SDK uploads its batches on its own schedule", async () => {
  const { flare } = create();

  flare.start();

  await expect(flare.flush()).resolves.toEqual({
    drained: true,
    destinations: { datadog: { status: "unsupported" } },
  });
});

test("the native handle is DdRum", () => {
  const { fake, flare } = create();

  flare.start();

  expect(flare.destination("datadog").native).toBe(fake.sdk);
});
