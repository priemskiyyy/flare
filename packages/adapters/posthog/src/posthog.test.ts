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

test("creating the adapter calls nothing on PostHog", () => {
  const fake = fakePostHog({ loaded: false });

  posthog({ sdk: fake.sdk });

  expect(fake.calls).toEqual({
    init: 0,
    captureException: 0,
    get_distinct_id: 0,
  });
});

test("a PostHog that was never initialized fails the start, and a retry after init succeeds", async () => {
  const { fake, flare } = create(fakePostHog({ loaded: false }));

  flare.start();

  const receipt = flare.capture(new Error("during boot"));

  expect(flare.destination("posthog").status.get()).toEqual({
    state: "failed",
    error: expect.objectContaining({
      name: "FlareError",
      code: "NOT_INITIALIZED",
      message:
        "PostHog is not initialized. Call posthog.init before flare.start().",
    }),
  });
  expect(fake.calls.captureException).toBe(0);

  fake.sdk.init();
  flare.start();

  await expect(receipt.settled).resolves.toMatchObject({
    outcomes: { posthog: { status: "submitted" } },
  });
  expect(fake.captured).toHaveLength(1);
});

test("a PostHog initialized without error tracking fails the start with a named error", () => {
  const { fake, flare } = create(fakePostHog({ exceptions: false }));

  flare.start();

  expect(flare.destination("posthog").status.get()).toEqual({
    state: "failed",
    error: expect.objectContaining({
      name: "FlareError",
      code: "UNSUPPORTED",
      message:
        "PostHog was initialized without error tracking, so it cannot capture exceptions.",
    }),
  });
  expect(fake.calls.captureException).toBe(0);
});

test("an exception is one $exception event with its causes, its level and PostHog's event id", async () => {
  const { fake, flare } = create();

  flare.start();

  const thrown = new TypeError("upload failed", {
    cause: new Error("disk full"),
  });

  const receipt = flare.capture(thrown, { level: "fatal" });
  const status = await receipt.settled;

  expect(fake.captured[0]?.properties).toMatchObject({
    $exception_list: [
      { type: "TypeError", value: "upload failed" },
      { type: "Error", value: "disk full" },
    ],
    $exception_level: "fatal",
    "flare.report_id": receipt.id,
  });
  expect(status).toEqual({
    state: "settled",
    outcomes: {
      posthog: {
        status: "submitted",
        evidence: "sdk-call-returned",
        event: { id: "uuid-1" },
        losses: [],
      },
    },
  });
});

test("tags and contexts become the event's own properties, and the operation is named", () => {
  const { fake, flare } = create();

  flare.start();
  flare.tag("plan", "pro");
  flare.context("workspace", { id: "w1", seats: 3 });

  flare.capture(new Error("boom"), {
    tags: { area: "upload", attempt: 2 },
    contexts: { upload: { kind: "avatar" } },
    operation: "upload-avatar",
  });

  expect(fake.captured[0]?.properties).toMatchObject({
    plan: "pro",
    area: "upload",
    attempt: 2,
    workspace: { id: "w1", seats: 3 },
    upload: { kind: "avatar" },
    "flare.operation": "upload-avatar",
  });
});

test("a report's properties win over PostHog's super properties on its event, and never change them", () => {
  const { fake, flare } = create();

  fake.sdk.register({ plan: "free", release: "1.2.0" });
  flare.start();

  flare.capture(new Error("boom"), { tags: { plan: "pro" } });

  expect(fake.captured[0]?.properties).toMatchObject({
    plan: "pro",
    release: "1.2.0",
  });
  expect(fake.state.superProperties).toEqual({
    plan: "free",
    release: "1.2.0",
  });
});

test("names PostHog gives meaning to are not written, so a report cannot move its event or change the person", async () => {
  const { fake, flare } = create();

  fake.sdk.identify("ada");
  flare.start();
  flare.user({ id: "ada" });

  const status = await flare.capture(new Error("boom"), {
    tags: {
      distinct_id: "grace",
      token: "phc_other",
      $exception_level: "info",
      "flare.report_id": "forged",
      "flare.aggregated": "forged",
      ["__proto__"]: "prototype",
      area: "upload",
    },
    contexts: {
      $set: { email: "grace@example.com" },
      $groups: { company: "other" },
      "flare.operation": { name: "forged" },
      upload: { kind: "avatar" },
    },
  }).settled;

  const properties = fake.captured[0]?.properties;

  expect(properties).toMatchObject({
    distinct_id: "ada",
    token: "phc_fake",
    $exception_level: "error",
    area: "upload",
    upload: { kind: "avatar" },
  });
  expect(properties).not.toHaveProperty("$set");
  expect(properties).not.toHaveProperty("$groups");
  expect(properties).not.toHaveProperty(["flare.operation"]);
  expect(properties?.["flare.report_id"]).not.toBe("forged");
  expect(fake.state.personProperties).toEqual({});
  expect(status).toMatchObject({
    outcomes: {
      posthog: {
        losses: [
          { path: "tags.distinct_id", reason: "unsupported" },
          { path: "tags.token", reason: "unsupported" },
          { path: "tags.$exception_level", reason: "unsupported" },
          { path: "tags.flare.report_id", reason: "unsupported" },
          { path: "tags.flare.aggregated", reason: "unsupported" },
          { path: "tags.__proto__", reason: "unsupported" },
          { path: "contexts.$set", reason: "unsupported" },
          { path: "contexts.$groups", reason: "unsupported" },
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

  expect(fake.captured[0]?.properties.upload).toBe("avatar");
  expect(status).toMatchObject({
    outcomes: {
      posthog: { losses: [{ path: "contexts.upload", reason: "unsupported" }] },
    },
  });
});

test("breadcrumbs become the event's exception steps, with PostHog's message and ISO timestamp", () => {
  const fake = fakePostHog();

  const flare = new Flare({
    destinations: { posthog: posthog({ sdk: fake.sdk }) },
    now: () => Date.UTC(2026, 8, 23, 12, 0, 0),
  });

  flare.start();
  flare.breadcrumb("uploadStarted", { kind: "avatar" });
  flare.breadcrumb("opened");

  flare.capture(new Error("boom"));

  expect(fake.captured[0]?.properties.$exception_steps).toEqual([
    {
      kind: "avatar",
      $message: "uploadStarted",
      $timestamp: "2026-09-23T12:00:00.000Z",
    },
    { $message: "opened", $timestamp: "2026-09-23T12:00:00.000Z" },
  ]);
});

test("the steps PostHog buffered are never attached, even to a report without breadcrumbs", () => {
  const { fake, flare } = create();

  flare.start();
  // Buffered for whoever uses the application now, not for this report.
  fake.sdk.addExceptionStep("clicked checkout as grace");

  flare.capture(new Error("boom"));

  expect(fake.captured[0]?.properties.$exception_steps).toEqual([]);
});

test("breadcrumb data that would replace a step's message or timestamp is a loss", async () => {
  const { fake, flare } = create();

  flare.start();
  flare.breadcrumb("opened", { $message: "forged", screen: "cart" });

  const status = await flare.capture(new Error("boom")).settled;

  expect(fake.captured[0]?.properties.$exception_steps).toMatchObject([
    { $message: "opened", screen: "cart" },
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

  const status = await flare.capture(
    new AggregateError([new Error("one"), new Error("two")], "several failed"),
  ).settled;

  expect(fake.captured[0]?.properties).toMatchObject({
    $exception_list: [{ type: "AggregateError", value: "several failed" }],
    "flare.aggregated": [
      { name: "Error", message: "one" },
      { name: "Error", message: "two" },
    ],
  });
  expect(status).toMatchObject({ outcomes: { posthog: { losses: [] } } });
});

test("a report whose user is not the person PostHog identifies is skipped, because PostHog would file it under that person", async () => {
  const { fake, flare } = create();

  fake.sdk.identify("operator");
  flare.start();
  flare.user({ id: "operator" });

  const onBehalf = await flare.capture(new Error("for a customer"), {
    user: { id: "customer-7" },
  }).settled;

  expect(onBehalf).toEqual({
    state: "settled",
    outcomes: { posthog: { status: "skipped", reason: "identity-mismatch" } },
  });
  expect(fake.captured).toEqual([]);
});

test("a report buffered under one account is skipped once PostHog identifies the next one", async () => {
  const fake = fakePostHog();

  const flare = new Flare({
    destinations: { posthog: posthog({ sdk: fake.sdk }) },
  });

  fake.sdk.identify("ada");
  flare.user({ id: "ada" });

  const receipt = flare.capture(new Error("captured as ada, before start"));

  fake.sdk.reset();
  fake.sdk.identify("grace");
  flare.user({ id: "grace" });
  flare.start();

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: { posthog: { status: "skipped", reason: "identity-mismatch" } },
  });
  expect(fake.captured).toEqual([]);
});

test("a report for the identified person, and an anonymous one, are both sent", () => {
  const { fake, flare } = create();

  flare.start();

  flare.capture(new Error("anonymous"));
  fake.sdk.identify("ada");
  flare.user({ id: "ada" });
  flare.capture(new Error("as ada"));

  expect(fake.captured.map((event) => event.properties.distinct_id)).toEqual([
    "anonymous-1",
    "ada",
  ]);
});

test("concurrent reports for different accounts never share properties", () => {
  const { fake, flare } = create();

  flare.start();

  flare.capture(new Error("first"), { tags: { owner: "ada" } });
  flare.capture(new Error("second"), { contexts: { cart: { items: 2 } } });

  expect(fake.captured[0]?.properties).not.toHaveProperty("cart");
  expect(fake.captured[1]?.properties).not.toHaveProperty("owner");
  expect(fake.state.superProperties).toEqual({});
});

test("an event PostHog's own filters drop is dropped as provider-filtered", async () => {
  const { fake, flare } = create();

  flare.start();
  fake.state.filtered = true;

  await expect(flare.capture(new Error("boom")).settled).resolves.toEqual({
    state: "settled",
    outcomes: { posthog: { status: "dropped", reason: "provider-filtered" } },
  });
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
  expect(fake.calls.captureException).toBe(0);
});

test("there is no flush: posthog-js sends its batches on its own schedule", async () => {
  const { flare } = create();

  flare.start();

  await expect(flare.flush()).resolves.toEqual({
    drained: true,
    destinations: { posthog: { status: "unsupported" } },
  });
});

test("the native handle is the posthog-js instance, and disposing leaves it running", () => {
  const { fake, flare } = create();

  flare.start();
  fake.sdk.register({ release: "1.2.0" });

  expect(flare.destination("posthog").native).toBe(fake.sdk);

  flare.dispose();

  expect(fake.sdk.__loaded).toBe(true);
  expect(fake.state.superProperties).toEqual({ release: "1.2.0" });
});
