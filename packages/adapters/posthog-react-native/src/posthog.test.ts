import { Flare } from "@priemskiyyy/flare";
import { expect, test } from "vitest";

import { fakePostHog } from "src/fakePostHog.fixture";
import { posthog } from "src/posthog";

const create = (fake = fakePostHog()) => {
  const flare = new Flare({
    destinations: { posthog: posthog({ sdk: fake.sdk }) },
  });

  return { fake, flare };
};

test("creating the adapter calls nothing on the client", () => {
  const fake = fakePostHog({ ready: false });

  posthog({ sdk: fake.sdk });

  expect(fake.calls).toEqual({
    ready: 0,
    getDistinctId: 0,
    captureException: 0,
    flush: 0,
  });
});

test("an exception is queued as one $exception event with the report's own properties", async () => {
  const { fake, flare } = create();

  flare.start();
  flare.breadcrumb("opened", { screen: "cart" });

  const thrown = new TypeError("upload failed", {
    cause: new Error("disk full"),
  });

  const receipt = flare.capture(thrown, {
    tags: { area: "upload", distinct_id: "grace" },
    contexts: { upload: { kind: "avatar" }, $groups: { company: "other" } },
    operation: "upload-avatar",
    level: "warning",
  });

  const status = await receipt.settled;

  expect(fake.queue).toHaveLength(1);
  expect(fake.queue[0]).toMatchObject({
    distinct_id: "anonymous-1",
    event: "$exception",
    properties: {
      $exception_list: [
        { type: "TypeError", value: "upload failed" },
        { type: "Error", value: "disk full" },
      ],
      $exception_level: "warning",
      $exception_steps: [{ $message: "opened", screen: "cart" }],
      area: "upload",
      upload: { kind: "avatar" },
      "flare.operation": "upload-avatar",
      "flare.report_id": receipt.id,
    },
  });
  expect(fake.queue[0]?.properties).not.toHaveProperty("distinct_id");
  expect(fake.state.superProperties).toEqual({});
  expect(status).toEqual({
    state: "settled",
    outcomes: {
      posthog: {
        status: "submitted",
        evidence: "sdk-call-returned",
        event: null,
        losses: [
          { path: "tags.distinct_id", reason: "unsupported" },
          { path: "contexts.$groups", reason: "unsupported" },
        ],
      },
    },
  });
});

test("names PostHog gives meaning to are not written, so a report cannot move its event or change the person", async () => {
  const { fake, flare } = create();

  fake.sdk.identify("ada");
  flare.start();
  flare.user({ id: "ada" });

  const status = await flare.capture(new Error("boom"), {
    tags: {
      token: "phc_other",
      $exception_level: "info",
      "flare.report_id": "forged",
      "flare.aggregated": "forged",
      ["__proto__"]: "prototype",
      area: "upload",
    },
    contexts: {
      $set: { email: "grace@example.com" },
      "flare.operation": { name: "forged" },
      upload: { kind: "avatar" },
    },
  }).settled;

  const event = fake.queue[0];

  expect(event?.distinct_id).toBe("ada");
  expect(event?.properties).toMatchObject({
    $exception_level: "error",
    area: "upload",
    upload: { kind: "avatar" },
  });
  expect(event?.properties).not.toHaveProperty("token");
  expect(event?.properties).not.toHaveProperty("$set");
  expect(event?.properties).not.toHaveProperty(["flare.operation"]);
  expect(event?.properties["flare.report_id"]).not.toBe("forged");
  expect(status).toMatchObject({
    outcomes: {
      posthog: {
        losses: [
          { path: "tags.token", reason: "unsupported" },
          { path: "tags.$exception_level", reason: "unsupported" },
          { path: "tags.flare.report_id", reason: "unsupported" },
          { path: "tags.flare.aggregated", reason: "unsupported" },
          { path: "tags.__proto__", reason: "unsupported" },
          { path: "contexts.$set", reason: "unsupported" },
          { path: "contexts.flare.operation", reason: "unsupported" },
        ],
      },
    },
  });
});

test("a context that shares its name with a tag is a loss, and the tag is written", async () => {
  const { fake, flare } = create();

  flare.start();

  const status = await flare.capture(new Error("boom"), {
    tags: { upload: "avatar" },
    contexts: { upload: { kind: "avatar", size: 3 } },
  }).settled;

  expect(fake.queue[0]?.properties.upload).toBe("avatar");
  expect(status).toMatchObject({
    outcomes: {
      posthog: { losses: [{ path: "contexts.upload", reason: "unsupported" }] },
    },
  });
});

test("breadcrumbs become exception steps, and data that would replace a step's message or timestamp is a loss", async () => {
  const fake = fakePostHog();

  const flare = new Flare({
    destinations: { posthog: posthog({ sdk: fake.sdk }) },
    now: () => Date.UTC(2026, 8, 23, 12, 0, 0),
  });

  flare.start();
  flare.breadcrumb("opened", { $message: "forged", screen: "cart" });

  const status = await flare.capture(new Error("boom")).settled;

  expect(fake.queue[0]?.properties.$exception_steps).toEqual([
    {
      screen: "cart",
      $message: "opened",
      $timestamp: "2026-09-23T12:00:00.000Z",
    },
  ]);
  expect(status).toMatchObject({
    outcomes: {
      posthog: {
        losses: [
          { path: "breadcrumbs.0.data.$message", reason: "unsupported" },
        ],
      },
    },
  });
});

test("the errors of an AggregateError travel as a property, since PostHog records one exception and its causes", async () => {
  const { fake, flare } = create();

  flare.start();

  await flare.capture(
    new AggregateError([new Error("one"), new Error("two")], "several failed"),
  ).settled;

  expect(fake.queue[0]?.properties).toMatchObject({
    $exception_list: [{ type: "AggregateError", value: "several failed" }],
    "flare.aggregated": [
      { name: "Error", message: "one" },
      { name: "Error", message: "two" },
    ],
  });
});

test("the steps the client buffered are never attached, even to a report without breadcrumbs", async () => {
  const { fake, flare } = create();

  flare.start();
  fake.sdk.addExceptionStep("tapped checkout as grace");

  await flare.capture(new Error("boom")).settled;

  expect(fake.queue[0]?.properties.$exception_steps).toEqual([]);
});

test("while the client loads its storage, a report waits and is checked against the distinct id it loads", async () => {
  const fake = fakePostHog({ ready: false });

  // The persisted person, which the client only knows once it has loaded.
  fake.state.distinctId = "ada";

  const { flare } = create(fake);

  flare.start();
  flare.user({ id: "ada" });

  const receipt = flare.capture(new Error("during boot"));

  await Promise.resolve();

  expect(fake.calls.captureException).toBe(0);

  fake.finishLoading();

  await expect(receipt.settled).resolves.toMatchObject({
    outcomes: { posthog: { status: "submitted" } },
  });
  expect(fake.queue[0]?.distinct_id).toBe("ada");
});

test("a report whose user is not the person the client identifies is skipped", async () => {
  const { fake, flare } = create();

  fake.sdk.identify("operator");
  flare.start();
  flare.user({ id: "operator" });

  await expect(
    flare.capture(new Error("for a customer"), { user: { id: "customer-7" } })
      .settled,
  ).resolves.toEqual({
    state: "settled",
    outcomes: { posthog: { status: "skipped", reason: "identity-mismatch" } },
  });
  expect(fake.calls.captureException).toBe(0);
});

test("a report the runtime abandoned while the client loaded is never captured", async () => {
  const fake = fakePostHog({ ready: false });
  const { flare } = create(fake);

  flare.start();

  const receipt = flare.capture(new Error("lost with the destination"));

  flare.dispose();
  fake.finishLoading();
  await new Promise((resolve) => setTimeout(resolve, 0));

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: { posthog: { status: "indeterminate", reason: "disposed" } },
  });
  expect(fake.calls.captureException).toBe(0);
});

test("a message is skipped, because PostHog tracks exceptions and nothing else", async () => {
  const { fake, flare } = create();

  flare.start();

  await expect(
    flare.message("Unexpected payment state").settled,
  ).resolves.toEqual({
    state: "settled",
    outcomes: {
      posthog: { status: "skipped", reason: "unsupported-report-kind" },
    },
  });
  expect(fake.calls.ready).toBe(0);
});

test("flush sends the client's queue, and a batch PostHog refused is a failed flush", async () => {
  const { fake, flare } = create();

  flare.start();
  await flare.capture(new Error("boom")).settled;

  await expect(flare.flush()).resolves.toEqual({
    drained: true,
    destinations: { posthog: { status: "flushed" } },
  });
  expect(fake.sent).toHaveLength(1);

  fake.state.flushFailure = new Error("PostHog answered 503");

  await expect(flare.flush()).resolves.toEqual({
    drained: true,
    destinations: {
      posthog: { status: "failed", error: fake.state.flushFailure },
    },
  });
});

test("the native handle is the client, and disposing leaves it running", async () => {
  const { fake, flare } = create();

  flare.start();

  expect(flare.destination("posthog").native).toBe(fake.sdk);

  flare.dispose();
  fake.sdk.captureException(new Error("the application's own"));

  expect(fake.queue).toHaveLength(1);
});
