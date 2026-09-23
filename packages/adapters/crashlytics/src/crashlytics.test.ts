import { Flare } from "@priemskiyyy/flare";
import { expect, test } from "vitest";

import { crashlytics } from "src/crashlytics";
import { fakeCrashlytics } from "src/fakeCrashlytics.fixture";

const create = (fake = fakeCrashlytics()) => {
  const flare = new Flare({
    destinations: { crashlytics: crashlytics({ sdk: fake.sdk }) },
  });

  return { fake, flare };
};

test("creating the adapter calls nothing on the SDK, not even getCrashlytics", () => {
  const fake = fakeCrashlytics();

  crashlytics({ sdk: fake.sdk });
  crashlytics({
    sdk: fake.sdk,
    ambient: { user: true, tags: true, contexts: true, breadcrumbs: true },
  });

  expect(fake.calls).toEqual({
    getCrashlytics: 0,
    setAttributes: 0,
    setUserId: 0,
  });
});

test("an exception is recorded as an Error rebuilt from the sanitized report, with its causes", async () => {
  const { fake, flare } = create();

  flare.start();

  const thrown = new TypeError("upload failed", {
    cause: new Error("disk full"),
  });

  const status = await flare.capture(thrown).settled;

  expect(fake.recorded[0]?.error).not.toBe(thrown);
  expect(fake.recorded[0]?.error).toMatchObject({
    name: "TypeError",
    message: "upload failed",
    stack: thrown.stack,
    cause: { message: "disk full" },
  });
  expect(status).toEqual({
    state: "settled",
    outcomes: {
      crashlytics: {
        status: "submitted",
        evidence: "sdk-call-returned",
        event: null,
        losses: [],
      },
    },
  });
});

test("recordError takes no metadata, so everything event-local is recorded as a loss and never faked through globals", async () => {
  const { fake, flare } = create();

  flare.start();
  flare.user({ id: "ada" });
  flare.breadcrumb("uploadStarted", { kind: "avatar" });

  const status = await flare.capture(new Error("boom"), {
    tags: { area: "upload" },
    contexts: { upload: { kind: "avatar" } },
    operation: "upload-avatar",
    level: "fatal",
  }).settled;

  expect(status).toMatchObject({
    outcomes: {
      crashlytics: {
        status: "submitted",
        losses: [
          { path: "identity.user", reason: "unsupported" },
          { path: "tags", reason: "unsupported" },
          { path: "contexts", reason: "unsupported" },
          { path: "breadcrumbs", reason: "unsupported" },
          { path: "operation", reason: "unsupported" },
          { path: "level", reason: "unsupported" },
        ],
      },
    },
  });
  expect(fake.recorded[0]).toMatchObject({ userId: "", logs: [] });
  expect(fake.recorded[0]?.attributes).toEqual({});
  expect(fake.state).toMatchObject({ userId: "", logs: [] });
  expect(fake.state.attributes).toEqual({});
  expect(fake.calls).toMatchObject({ setAttributes: 0, setUserId: 0 });
});

test("without user mirroring, a report whose user signed out since it was captured is not recorded under the next one", async () => {
  const { fake, flare } = create();

  flare.user({ id: "ada" });

  const receipt = flare.capture(new Error("captured as ada, before start"));

  flare.user({ id: "grace" });
  flare.start();

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: {
      crashlytics: { status: "skipped", reason: "identity-mismatch" },
    },
  });
  expect(fake.recorded).toEqual([]);
});

test("without user mirroring, an anonymous report buffered before a sign-in is recorded", async () => {
  const { fake, flare } = create();
  const receipt = flare.capture(new Error("during boot"));

  flare.user({ id: "ada" });
  flare.start();

  await expect(receipt.settled).resolves.toMatchObject({
    outcomes: { crashlytics: { status: "submitted" } },
  });
  expect(fake.recorded).toHaveLength(1);
});

test("a message is skipped, because Crashlytics records errors and nothing else", async () => {
  const { fake, flare } = create();

  flare.start();

  await expect(
    flare.message("Unexpected payment state").settled,
  ).resolves.toEqual({
    state: "settled",
    outcomes: {
      crashlytics: { status: "skipped", reason: "unsupported-report-kind" },
    },
  });
  expect(fake.recorded).toEqual([]);
});

test("a recordError that throws is a failed outcome and never reaches the application", async () => {
  const { fake, flare } = create();

  flare.start();
  fake.state.recordFailure = new Error("native module missing");

  await expect(flare.capture(new Error("boom")).settled).resolves.toEqual({
    state: "settled",
    outcomes: {
      crashlytics: { status: "failed", error: fake.state.recordFailure },
    },
  });
});

test("there is no flush: sendUnsentReports acknowledges nothing", async () => {
  const { flare } = create();

  flare.start();

  await expect(flare.flush()).resolves.toEqual({
    drained: true,
    destinations: { crashlytics: { status: "unsupported" } },
  });
});

test("the native handle is the Crashlytics instance, obtained when the destination opens", () => {
  const { fake, flare } = create();

  expect(flare.destination("crashlytics").native).toBeNull();

  flare.start();

  expect(flare.destination("crashlytics").native).toBe(fake.instance);
  expect(fake.calls.getCrashlytics).toBe(1);
});
