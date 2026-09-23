import { Flare } from "@priemskiyyy/flare";
import { expect, test } from "vitest";

import { bugsnag } from "src/bugsnag";
import { fakeBugsnag } from "src/fakeBugsnag.fixture";

const create = (
  options: Partial<Parameters<typeof bugsnag>[0]> = {},
  fake = fakeBugsnag(),
) => {
  const flare = new Flare({
    destinations: {
      bugsnag: bugsnag({
        sdk: fake.sdk,
        Breadcrumb: fake.Breadcrumb,
        ...options,
      }),
    },
  });

  return { fake, flare };
};

test("creating the adapter calls nothing on the SDK", () => {
  const fake = fakeBugsnag({ started: false });

  bugsnag({ sdk: fake.sdk });
  bugsnag({ sdk: fake.sdk, ownership: "owned", start: fake.start });

  expect(fake.calls.start).toBe(0);
  expect(fake.events).toEqual([]);
});

test("an empty report tag set still clears the reserved tags section on the event", () => {
  const { fake, flare } = create();

  fake.sdk.addMetadata("tags", { owner: "provider account" });
  flare.start();
  flare.capture(new Error("no tags"));

  expect(fake.events[0]?.metadata.tags).toBeUndefined();
  expect(fake.client.metadata.tags).toEqual({ owner: "provider account" });
});

test("a mapping failure discards the event and settles as failed even after an asynchronous SDK hook", async () => {
  const fake = fakeBugsnag();
  const failure = new Error("breadcrumb construction failed");

  class BrokenBreadcrumb extends fake.Breadcrumb {
    constructor() {
      super();
      throw failure;
    }
  }

  const { flare } = create({ Breadcrumb: BrokenBreadcrumb }, fake);

  flare.start();
  flare.breadcrumb("opened");
  fake.state.holdBeforeOnError = true;

  const receipt = flare.capture(new Error("original"));

  expect(() => fake.release()).not.toThrow();

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: { bugsnag: { status: "failed", error: failure } },
  });
  expect(fake.events).toEqual([]);
});

test("an exception reaches Bugsnag as an Error rebuilt from the sanitized report, with its causes", () => {
  const { fake, flare } = create();

  flare.start();

  const thrown = new TypeError("upload failed", {
    cause: new Error("disk full"),
  });

  flare.capture(thrown);

  expect(fake.events[0]?.error).not.toBe(thrown);
  expect(fake.events[0]?.error).toMatchObject({
    name: "TypeError",
    message: "upload failed",
    stack: thrown.stack,
    cause: { message: "disk full" },
  });
});

test("user, severity, operation, tags, contexts and breadcrumbs are applied to the event only", () => {
  const { fake, flare } = create();

  flare.start();
  flare.user({ id: "ada", email: "ada@example.com", name: "Ada" });
  flare.breadcrumb("uploadStarted", { kind: "avatar" });

  const receipt = flare.capture(new Error("boom"), {
    tags: { area: "upload", attempt: 2 },
    contexts: { upload: { kind: "avatar" } },
    operation: "upload-avatar",
    level: "warning",
  });

  expect(fake.events[0]).toMatchObject({
    severity: "warning",
    context: "upload-avatar",
    user: { id: "ada", email: "ada@example.com", name: "Ada" },
  });
  expect(fake.events[0]?.metadata).toEqual({
    tags: { area: "upload", attempt: 2 },
    upload: { kind: "avatar" },
    flare: { reportId: receipt.id, level: "warning" },
  });
  expect(
    fake.events[0]?.breadcrumbs.map((breadcrumb) => breadcrumb.toJSON()),
  ).toEqual([
    {
      type: "manual",
      name: "uploadStarted",
      timestamp: expect.any(Date),
      metaData: { kind: "avatar" },
    },
  ]);
  expect(fake.client).toEqual({ user: {}, metadata: {}, breadcrumbs: [] });
});

test("Bugsnag's display context is the operation, and Flare contexts stay in metadata", () => {
  const { fake, flare } = create();

  flare.start();

  flare.capture(new Error("boom"), { contexts: { checkout: { step: 2 } } });

  expect(fake.events[0]?.context).toBeUndefined();
  expect(fake.events[0]?.metadata.checkout).toEqual({ step: 2 });
});

test("a report's context replaces a section of the same name on the event, and is never merged into it", () => {
  const { fake, flare } = create();

  flare.start();
  fake.sdk.addMetadata("upload", { kind: "avatar", attempt: 1 });

  flare.capture(new Error("boom"), { contexts: { upload: { attempt: 2 } } });

  expect(fake.events[0]?.metadata.upload).toEqual({ attempt: 2 });
  expect(fake.client.metadata.upload).toEqual({ kind: "avatar", attempt: 1 });
});

test.each([
  { error: new Error("one"), aggregated: undefined },
  {
    error: new AggregateError([new Error("one")], "several failed"),
    aggregated: { errors: [{ name: "Error", message: "one" }] },
  },
])(
  "reserved metadata sections cannot be replaced by report contexts ($error.name)",
  async ({ error, aggregated }) => {
    const { fake, flare } = create();

    flare.start();

    const receipt = flare.capture(error, {
      tags: { area: "upload" },
      contexts: {
        tags: { area: "wrong" },
        flare: { reportId: "wrong" },
        "flare.aggregated": { errors: "wrong" },
        upload: { attempt: 1 },
      },
    });

    await expect(receipt.settled).resolves.toMatchObject({
      outcomes: {
        bugsnag: {
          status: "submitted",
          losses: [
            { path: "contexts.tags", reason: "unsupported" },
            { path: "contexts.flare", reason: "unsupported" },
            { path: "contexts.flare.aggregated", reason: "unsupported" },
          ],
        },
      },
    });
    expect(fake.events[0]?.metadata.tags).toEqual({ area: "upload" });
    expect(fake.events[0]?.metadata.flare).toEqual({
      reportId: receipt.id,
      level: "error",
    });
    expect(fake.events[0]?.metadata["flare.aggregated"]).toEqual(aggregated);
    expect(fake.events[0]?.metadata.upload).toEqual({ attempt: 1 });
  },
);

test("breadcrumb time is handed over as a Date", () => {
  const fake = fakeBugsnag();

  const flare = new Flare({
    destinations: {
      bugsnag: bugsnag({ sdk: fake.sdk, Breadcrumb: fake.Breadcrumb }),
    },
    now: () => 1_767_225_600_500,
  });

  flare.start();
  flare.breadcrumb("opened");

  flare.capture(new Error("boom"));

  expect(fake.events[0]?.breadcrumbs[0]?.timestamp).toEqual(
    new Date(1_767_225_600_500),
  );
});

test("Bugsnag's own breadcrumbs stay on the event, in time order with Flare's", () => {
  const fake = fakeBugsnag();
  let clock = 1_000;

  const flare = new Flare({
    destinations: {
      bugsnag: bugsnag({ sdk: fake.sdk, Breadcrumb: fake.Breadcrumb }),
    },
    now: () => clock,
  });

  flare.start();
  flare.breadcrumb("flare-first");

  const automatic = new fake.Breadcrumb();

  automatic.message = "bugsnag-navigation";
  automatic.timestamp = new Date(2_000);
  fake.client.breadcrumbs.push(automatic);
  clock = 3_000;
  flare.breadcrumb("flare-last");

  flare.capture(new Error("boom"));

  expect(
    fake.events[0]?.breadcrumbs.map((breadcrumb) => breadcrumb.message),
  ).toEqual(["flare-first", "bugsnag-navigation", "flare-last"]);
  expect(fake.client.breadcrumbs).toEqual([automatic]);
});

test("an anonymous report clears the user the client would otherwise copy onto the event", () => {
  const { fake, flare } = create();

  flare.start();
  fake.sdk.setUser("left-behind", "old@example.com", "Old");

  flare.capture(new Error("after logout"));

  expect(fake.events[0]?.user).toEqual({
    id: undefined,
    email: undefined,
    name: undefined,
  });
  expect(fake.client.user).toEqual({
    id: "left-behind",
    email: "old@example.com",
    name: "Old",
  });
});

test("concurrent reports for different accounts never share an event", () => {
  const { fake, flare } = create();

  flare.start();

  flare.capture(new Error("as ada"), {
    user: { id: "ada" },
    tags: { owner: "ada" },
  });
  flare.capture(new Error("as grace"), { user: { id: "grace" } });

  expect(
    fake.events.map((event) => [event.user.id, event.metadata.tags]),
  ).toEqual([
    ["ada", { owner: "ada" }],
    ["grace", undefined],
  ]);
});

test("fatal has no Bugsnag severity, so it is sent as error and the loss is recorded", async () => {
  const { fake, flare } = create();

  flare.start();

  const status = await flare.capture(new Error("boom"), { level: "fatal" })
    .settled;

  expect(fake.events[0]).toMatchObject({
    severity: "error",
    metadata: { flare: { level: "fatal" } },
  });
  expect(status).toMatchObject({
    outcomes: {
      bugsnag: { losses: [{ path: "level", reason: "unsupported" }] },
    },
  });
});

test("aggregated errors travel as metadata, since Bugsnag has no field for them", () => {
  const { fake, flare } = create();

  flare.start();

  flare.capture(
    new AggregateError([new Error("one"), new Error("two")], "several failed"),
  );

  expect(fake.events[0]?.metadata["flare.aggregated"]).toEqual({
    errors: [
      { name: "Error", message: "one" },
      { name: "Error", message: "two" },
    ],
  });
});

test("the callback is the evidence, and it cannot tell delivered from enqueued or discarded", async () => {
  const { fake, flare } = create();

  flare.start();

  const delivered = await flare.capture(new Error("sent")).settled;

  fake.state.applicationKeepsEvents = false;

  const discarded = await flare.capture(
    new Error("discarded by the application's onError"),
  ).settled;

  const submitted = {
    status: "submitted",
    evidence: "sdk-callback-completed",
    event: null,
    losses: [],
  };

  expect(delivered).toEqual({
    state: "settled",
    outcomes: { bugsnag: submitted },
  });
  expect(discarded).toEqual({
    state: "settled",
    outcomes: { bugsnag: submitted },
  });
  expect(fake.events).toHaveLength(1);
});

test("a delivery error reported by the callback is a failed outcome", async () => {
  const failure = new Error("delivery failed");
  const { fake, flare } = create();

  flare.start();
  fake.state.deliveryError = failure;

  await expect(flare.capture(new Error("boom")).settled).resolves.toEqual({
    state: "settled",
    outcomes: { bugsnag: { status: "failed", error: failure } },
  });
});

test("the outcome waits for the callback, not for notify to return", async () => {
  const { fake, flare } = create();

  flare.start();
  fake.state.hold = true;

  const receipt = flare.capture(new Error("boom"));

  await Promise.resolve();

  expect(receipt.status.get()).toEqual({
    state: "pending",
    outcomes: { bugsnag: null },
  });

  fake.release();

  await expect(receipt.settled).resolves.toMatchObject({
    outcomes: { bugsnag: { status: "submitted" } },
  });
});

test.each([false, true])(
  "without the Breadcrumb class breadcrumbs stay unsupported with mirroring %s",
  async (mirrored) => {
    const fake = fakeBugsnag();

    const adapter = bugsnag({
      sdk: fake.sdk,
      ambient: { breadcrumbs: mirrored },
    });

    const flare = new Flare({ destinations: { bugsnag: adapter } });

    flare.start();
    flare.breadcrumb("opened");

    const status = await flare.capture(new Error("boom")).settled;

    expect(adapter.capabilities.eventLocal.breadcrumbs).toBe(false);
    expect(fake.events[0]?.breadcrumbs).toEqual([]);
    expect(status).toMatchObject({
      outcomes: {
        bugsnag: { losses: [{ path: "breadcrumbs", reason: "unsupported" }] },
      },
    });
  },
);

test("a message is skipped by default, because Bugsnag can only carry it as a fake error", async () => {
  const fake = fakeBugsnag();
  const adapter = bugsnag({ sdk: fake.sdk });
  const flare = new Flare({ destinations: { bugsnag: adapter } });

  flare.start();

  const status = await flare.message("Unexpected payment state").settled;

  expect(adapter.capabilities.messages).toBe(false);
  expect(status).toEqual({
    state: "settled",
    outcomes: {
      bugsnag: { status: "skipped", reason: "unsupported-report-kind" },
    },
  });
  expect(fake.events).toEqual([]);
});

test("messages can be opted into as errors, and the lossy mapping is recorded", async () => {
  const { fake, flare } = create({ messages: "as-error" });

  flare.start();

  const status = await flare.message("Unexpected payment state", {
    level: "warning",
  }).settled;

  expect(fake.events[0]).toMatchObject({
    error: { name: "Message", message: "Unexpected payment state" },
    severity: "warning",
  });
  expect(status).toMatchObject({
    outcomes: {
      bugsnag: {
        status: "submitted",
        losses: [{ path: "kind", reason: "unsupported" }],
      },
    },
  });
});

test("a borrowed SDK that is not started fails to start, and a retry after the application starts it succeeds", () => {
  const fake = fakeBugsnag({ started: false });
  const { flare } = create({}, fake);

  flare.start();

  expect(flare.destination("bugsnag").status.get()).toMatchObject({
    state: "failed",
    error: new Error(
      'Bugsnag is not started. Call Bugsnag.start before flare.start(), or pass ownership: "owned" with a start function.',
    ),
  });
  expect(fake.calls.start).toBe(0);

  fake.start();
  flare.start();

  expect(flare.destination("bugsnag").status.get()).toEqual({ state: "ready" });
});

test("an owned SDK is started when the destination opens, and a borrowed one never is", () => {
  const owned = fakeBugsnag({ started: false });
  const borrowed = fakeBugsnag();
  const first = create({ ownership: "owned", start: owned.start }, owned);
  const second = create({}, borrowed);

  first.flare.start();
  second.flare.start();
  first.flare.dispose();
  second.flare.dispose();

  expect(owned.calls.start).toBe(1);
  expect(borrowed.calls.start).toBe(0);
});

test("the capabilities say what the browser SDK can honestly do", () => {
  const fake = fakeBugsnag();

  expect(
    bugsnag({ sdk: fake.sdk, Breadcrumb: fake.Breadcrumb }).capabilities,
  ).toEqual({
    eventLocal: { user: true, tags: true, contexts: true, breadcrumbs: true },
    messages: false,
    evidence: "sdk-callback-completed",
    flush: "none",
    queue: "none",
    automaticCapture: "provider-owned",
    instance: "singleton",
    filtering: "provider-hooks",
  });
});

test("the native handle is the SDK the application injected, and one SDK cannot be registered twice", () => {
  const { fake, flare } = create();

  flare.start();

  expect(flare.destination("bugsnag").native).toBe(fake.sdk);
  expect(
    () =>
      new Flare({
        destinations: {
          first: bugsnag({ sdk: fake.sdk }),
          second: bugsnag({ sdk: fake.sdk }),
        },
      }),
  ).toThrow(
    'Flare destinations "first" and "second" drive the same singleton SDK. Register it once.',
  );
});
