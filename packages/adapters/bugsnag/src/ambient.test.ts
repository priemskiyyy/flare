import { Flare } from "@priemskiyyy/flare";
import { expect, test } from "vitest";

import { bugsnag } from "src/bugsnag";
import { fakeBugsnag } from "src/fakeBugsnag.fixture";

const create = (
  ambient: NonNullable<Parameters<typeof bugsnag>[0]["ambient"]>,
) => {
  const fake = fakeBugsnag();

  const flare = new Flare({
    destinations: {
      bugsnag: bugsnag({ sdk: fake.sdk, Breadcrumb: fake.Breadcrumb, ambient }),
    },
  });

  flare.start();

  return { fake, flare };
};

const signedOut = { id: undefined, email: undefined, name: undefined };

test("without the ambient option nothing is ever mirrored into the Bugsnag client", () => {
  const fake = fakeBugsnag();

  const flare = new Flare({
    destinations: { bugsnag: bugsnag({ sdk: fake.sdk }) },
  });

  flare.start();

  flare.user({ id: "ada" });
  flare.tag("plan", "pro");
  flare.context("workspace", { id: "w1" });
  flare.breadcrumb("opened");

  expect(fake.client).toEqual({ user: {}, metadata: {}, breadcrumbs: [] });
});

test("with no ambient part enabled the session has no ambient member at all", async () => {
  const open = (ambient?: Parameters<typeof bugsnag>[0]["ambient"]) =>
    bugsnag({
      sdk: fakeBugsnag().sdk,
      ...(ambient === undefined ? {} : { ambient }),
    }).open({
      destination: "bugsnag",
    });

  expect("ambient" in (await open())).toBe(false);
  expect("ambient" in (await open({ tags: false }))).toBe(false);
  expect(typeof (await open({ tags: true })).ambient?.session).toBe("function");
});

test("only the parts that were asked for are mirrored", () => {
  const { fake, flare } = create({ user: true });

  flare.user({ id: "ada", email: "ada@example.com", name: "Ada" });
  flare.tag("plan", "pro");
  flare.context("workspace", { id: "w1" });
  flare.breadcrumb("opened");

  expect(fake.client).toEqual({
    user: { id: "ada", email: "ada@example.com", name: "Ada" },
    metadata: {},
    breadcrumbs: [],
  });
});

test("the user is not mirrored when only other parts were asked for", () => {
  const { fake, flare } = create({
    tags: true,
    contexts: true,
    breadcrumbs: true,
  });

  flare.user({ id: "ada" });
  flare.tag("plan", "pro");

  expect(fake.client.user).toEqual({});
  expect(fake.client.metadata).toEqual({ tags: { plan: "pro" } });
});

test("a context is replaced in Bugsnag as a whole, not merged into its previous keys", () => {
  const { fake, flare } = create({ contexts: true });

  flare.context("upload", { kind: "avatar", attempt: 1 });

  flare.context("upload", { attempt: 2 });

  expect(fake.client.metadata).toEqual({ upload: { attempt: 2 } });
});

test("ambient contexts cannot replace Flare's reserved metadata sections", () => {
  const { fake, flare } = create({ tags: true, contexts: true });

  flare.tag("plan", "pro");

  flare.context("tags", { plan: "wrong" });
  flare.context("flare", { reportId: "wrong" });
  flare.context("flare.aggregated", { errors: "wrong" });
  flare.context("workspace", { id: "w1" });

  expect(fake.client.metadata).toEqual({
    tags: { plan: "pro" },
    workspace: { id: "w1" },
  });
  flare.context("tags", null);
  expect(fake.client.metadata.tags).toEqual({ plan: "pro" });
});

test("signing out and removing a tag or a context are mirrored too", () => {
  const { fake, flare } = create({ user: true, tags: true, contexts: true });

  flare.user({ id: "ada" });
  flare.tag("plan", "pro");
  flare.tag("area", "upload");
  flare.context("workspace", { id: "w1" });
  flare.context("device", { model: "x" });

  flare.tag("plan", null);
  flare.context("workspace", null);

  expect(fake.client.metadata).toEqual({
    tags: { area: "upload" },
    device: { model: "x" },
  });

  flare.user(null);

  expect(fake.client.user).toEqual(signedOut);
  // Tags are taken back key by key, because the application may keep keys of
  // its own in the same section. Bugsnag leaves the emptied section in place.
  expect(fake.client.metadata).toEqual({ tags: {} });
});

test("a report delivered after an account switch carries nothing the mirror wrote for the new account", () => {
  const fake = fakeBugsnag();

  const flare = new Flare({
    destinations: {
      bugsnag: bugsnag({
        sdk: fake.sdk,
        ambient: { user: true, tags: true, contexts: true },
      }),
    },
  });

  flare.user({ id: "ada" });
  flare.capture(new Error("captured as ada, before start"));

  flare.user({ id: "grace" });
  flare.tag("plan", "grace-plan");
  flare.context("workspace", { owner: "grace" });
  flare.start();

  expect(fake.client.metadata).toEqual({
    tags: { plan: "grace-plan" },
    workspace: { owner: "grace" },
  });
  expect(fake.events[0]?.user.id).toBe("ada");
  expect(fake.events[0]?.metadata).toEqual({
    flare: { reportId: expect.any(String), level: "error" },
  });
  expect(JSON.stringify(fake.events[0]?.metadata)).not.toContain("grace");
});

test("mirrored breadcrumbs are stamped with their identity generation", () => {
  const { fake, flare } = create({ breadcrumbs: true });

  flare.user({ id: "ada" });

  flare.breadcrumb("ada-opened-billing", { plan: "pro" });

  expect(
    fake.client.breadcrumbs.map((breadcrumb) => breadcrumb.toJSON()),
  ).toMatchObject([
    {
      name: "ada-opened-billing",
      metaData: { plan: "pro", "flare.generation": 1 },
    },
  ]);
});

test("delayed SDK hooks clear the mirror that was copied onto the event at submission", async () => {
  const fake = fakeBugsnag();

  const flare = new Flare({
    destinations: {
      bugsnag: bugsnag({ sdk: fake.sdk, ambient: { contexts: true } }),
    },
  });

  const receipt = flare.capture(new Error("anonymous buffered report"));

  flare.user({ id: "first" });
  flare.context("firstAccount", { cart: "private cart" });
  fake.state.holdBeforeOnError = true;
  flare.start();

  flare.user({ id: "second" });
  flare.context("secondAccount", { cart: "new cart" });
  fake.release();
  await receipt.settled;

  expect(fake.events[0]?.metadata).toEqual({
    flare: { reportId: receipt.id, level: "error" },
  });
});

test("Bugsnag cannot clear breadcrumbs, so a report drops the previous account's mirrored ones itself", () => {
  const { fake, flare } = create({ breadcrumbs: true });

  flare.user({ id: "ada" });
  flare.breadcrumb("ada-opened-billing");
  flare.user({ id: "grace" });
  flare.breadcrumb("grace-opened-editor");

  flare.capture(new Error("as grace"));

  expect(
    fake.client.breadcrumbs.map((breadcrumb) => breadcrumb.message),
  ).toEqual(["ada-opened-billing", "grace-opened-editor"]);
  expect(
    fake.events[0]?.breadcrumbs.map((breadcrumb) => breadcrumb.message),
  ).toEqual(["grace-opened-editor"]);
});

test("Bugsnag's own breadcrumbs carry no generation and are always kept", () => {
  const { fake, flare } = create({ breadcrumbs: true });

  flare.user({ id: "ada" });
  flare.breadcrumb("ada-step");
  flare.user({ id: "grace" });

  const automatic = new fake.Breadcrumb();

  automatic.message = "bugsnag-navigation";
  fake.client.breadcrumbs.push(automatic);
  flare.breadcrumb("grace-step");

  flare.capture(new Error("as grace"));

  expect(
    fake.events[0]?.breadcrumbs.map((breadcrumb) => breadcrumb.message),
  ).toEqual(["bugsnag-navigation", "grace-step"]);
});

test("mirrored breadcrumbs are not added a second time to the events Flare submits", () => {
  const { fake, flare } = create({ breadcrumbs: true });

  flare.breadcrumb("opened");

  flare.capture(new Error("boom"));

  expect(fake.events[0]?.breadcrumbs).toHaveLength(1);
});

test("buffered reports carry the breadcrumbs captured before the mirror started", () => {
  const fake = fakeBugsnag();

  const flare = new Flare({
    destinations: {
      bugsnag: bugsnag({
        sdk: fake.sdk,
        Breadcrumb: fake.Breadcrumb,
        ambient: { breadcrumbs: true },
      }),
    },
  });

  flare.breadcrumb("before-start");
  flare.capture(new Error("buffered"));
  flare.breadcrumb("after-capture");

  flare.start();

  expect(
    fake.events[0]?.breadcrumbs.map((breadcrumb) => breadcrumb.message),
  ).toEqual(["before-start"]);
});

test("disposing a borrowed SDK removes what Flare mirrored and nothing else", () => {
  const { fake, flare } = create({ user: true, tags: true, contexts: true });

  fake.sdk.addMetadata("app", { build: 7 });
  fake.sdk.addMetadata("tags", { release: "set by the application" });
  flare.user({ id: "ada" });
  flare.tag("plan", "pro");
  flare.context("workspace", { id: "w1" });

  flare.dispose();

  expect(fake.client.user).toEqual(signedOut);
  expect(fake.client.metadata).toEqual({
    app: { build: 7 },
    tags: { release: "set by the application" },
  });
});
