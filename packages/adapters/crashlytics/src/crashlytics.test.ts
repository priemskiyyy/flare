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

test("the capabilities say how little Crashlytics can do per report", () => {
  expect(crashlytics({ sdk: fakeCrashlytics().sdk }).capabilities).toEqual({
    eventLocal: {
      user: false,
      tags: false,
      contexts: false,
      breadcrumbs: false,
    },
    messages: false,
    evidence: "sdk-call-returned",
    flush: "none",
    queue: "sdk-persistent",
    automaticCapture: "provider-owned",
    instance: "singleton",
    filtering: "provider-hooks",
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

test("the same SDK registered under two names is rejected before anything opens", () => {
  const fake = fakeCrashlytics();

  expect(
    () =>
      new Flare({
        destinations: {
          first: crashlytics({ sdk: fake.sdk }),
          second: crashlytics({ sdk: fake.sdk }),
        },
      }),
  ).toThrow(
    'Flare destinations "first" and "second" drive the same singleton SDK. Register it once.',
  );
});
