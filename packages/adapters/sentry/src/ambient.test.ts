import { Flare } from "@priemskiyyy/flare";
import { expect, test, vi } from "vitest";

import { fakeSentry } from "src/fakeSentry.fixture";
import { sentry } from "src/sentry";

const create = (
  ambient: NonNullable<Parameters<typeof sentry>[0]["ambient"]>,
) => {
  const fake = fakeSentry();

  const flare = new Flare({
    destinations: { sentry: sentry({ sdk: fake.sdk, ambient }) },
  });

  flare.start();

  return { fake, flare };
};

const untouched = {
  user: null,
  level: null,
  tags: {},
  contexts: {},
  breadcrumbs: [],
  transactionName: null,
};

test("removing a prototype-named tag reaches the SDK as an own undefined field", () => {
  const { fake, flare } = create({ tags: true });
  const setTags = vi.spyOn(fake.sdk, "setTags");

  flare.tag("__proto__", "value");
  flare.tag("__proto__", null);

  const removed = setTags.mock.calls.at(-1)?.[0];

  expect(Object.hasOwn(removed ?? {}, "__proto__")).toBe(true);
  expect(removed?.["__proto__"]).toBeUndefined();
});

test("without the ambient option nothing is ever mirrored into Sentry's global scope", () => {
  const fake = fakeSentry();

  const flare = new Flare({
    destinations: { sentry: sentry({ sdk: fake.sdk }) },
  });

  flare.start();

  flare.user({ id: "ada" });
  flare.tag("plan", "pro");
  flare.context("workspace", { id: "w1" });
  flare.breadcrumb("opened");

  expect(fake.global).toEqual(untouched);
});

test("with no ambient part enabled the session has no ambient member at all", async () => {
  const open = (ambient?: Parameters<typeof sentry>[0]["ambient"]) =>
    sentry({
      sdk: fakeSentry().sdk,
      ...(ambient === undefined ? {} : { ambient }),
    }).open({
      destination: "sentry",
    });

  const bare = await open();
  const off = await open({ user: false });
  const on = await open({ user: true });

  expect("ambient" in bare).toBe(false);
  expect("ambient" in off).toBe(false);
  expect(typeof on.ambient?.session).toBe("function");
  expect("breadcrumb" in (on.ambient ?? {})).toBe(false);
});

test("only the parts that were asked for are mirrored", () => {
  const { fake, flare } = create({ user: true });

  flare.user({ id: "ada", name: "Ada" });
  flare.tag("plan", "pro");
  flare.context("workspace", { id: "w1" });
  flare.breadcrumb("opened");

  expect(fake.global).toEqual({
    ...untouched,
    user: { id: "ada", username: "Ada" },
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

  expect(fake.global.user).toBeNull();
  expect(fake.global.tags).toEqual({ plan: "pro" });
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

  expect(fake.global.user).toEqual({ id: "ada" });
  expect(fake.global.tags).toEqual({ area: "upload" });
  expect(fake.global.contexts).toEqual({ device: { model: "x" } });

  flare.user(null);

  expect(fake.global.user).toBeNull();
  expect(fake.global.tags).toEqual({});
  expect(fake.global.contexts).toEqual({});
});

test("a report delivered after an account switch carries nothing the mirror wrote for the new account", () => {
  const fake = fakeSentry();

  const flare = new Flare({
    destinations: {
      sentry: sentry({
        sdk: fake.sdk,
        ambient: { user: true, tags: true, contexts: true },
      }),
    },
  });

  flare.user({ id: "ada" });

  const receipt = flare.capture(new Error("captured as ada, before start"));

  flare.user({ id: "grace" });
  flare.tag("plan", "grace-plan");
  flare.context("workspace", { owner: "grace" });
  flare.start();

  expect(fake.global.tags).toEqual({ plan: "grace-plan" });
  expect(fake.global.contexts).toEqual({ workspace: { owner: "grace" } });
  expect(fake.events[0]?.scope.user).toEqual({ id: "ada" });
  expect(fake.events[0]?.scope.tags).toEqual({ "flare.report_id": receipt.id });
  expect(fake.events[0]?.scope.contexts).toEqual({});
});

test("mirrored breadcrumbs are cleared from Sentry when the account changes", () => {
  const { fake, flare } = create({ breadcrumbs: true });

  flare.user({ id: "ada" });
  flare.breadcrumb("ada-opened-billing");

  expect(fake.global.breadcrumbs).toMatchObject([
    { message: "ada-opened-billing" },
  ]);

  flare.user({ id: "grace" });

  expect(fake.global.breadcrumbs).toEqual([]);
});

test("mirrored breadcrumbs are not added a second time to the events Flare submits", () => {
  const { fake, flare } = create({ breadcrumbs: true });

  flare.breadcrumb("opened");

  flare.capture(new Error("boom"));

  expect(fake.events[0]?.scope.breadcrumbs).toHaveLength(1);
});

test("buffered reports carry the breadcrumbs captured before the mirror started", () => {
  const fake = fakeSentry();

  const flare = new Flare({
    destinations: {
      sentry: sentry({ sdk: fake.sdk, ambient: { breadcrumbs: true } }),
    },
  });

  flare.breadcrumb("before-start");
  flare.message("buffered");
  flare.breadcrumb("after-capture");

  flare.start();

  expect(fake.events[0]?.scope.breadcrumbs).toMatchObject([
    { message: "before-start" },
  ]);
});

test("disposing a borrowed SDK removes what Flare mirrored and nothing else", () => {
  const { fake, flare } = create({ user: true, tags: true, contexts: true });

  fake.sdk.setTags({ release: "set by the application" });
  fake.sdk.setContext("app", { build: 7 });
  flare.user({ id: "ada" });
  flare.tag("plan", "pro");
  flare.context("workspace", { id: "w1" });

  flare.dispose();

  expect(fake.global.user).toBeNull();
  expect(fake.global.tags).toEqual({ release: "set by the application" });
  expect(fake.global.contexts).toEqual({ app: { build: 7 } });
});
