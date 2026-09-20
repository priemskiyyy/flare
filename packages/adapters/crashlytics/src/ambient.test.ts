import { Flare } from "@priemskiyyy/flare";
import { expect, test, vi } from "vitest";

import { crashlytics } from "src/crashlytics";
import { fakeCrashlytics } from "src/fakeCrashlytics.fixture";

const create = (
  ambient: NonNullable<Parameters<typeof crashlytics>[0]["ambient"]>,
) => {
  const fake = fakeCrashlytics();
  const flare = new Flare({
    destinations: { crashlytics: crashlytics({ sdk: fake.sdk, ambient }) },
  });
  flare.start();
  return { fake, flare };
};

test("prototype-named keys reach native setters and can be blanked", () => {
  const { fake, flare } = create({ tags: true });
  const setAttributes = vi.spyOn(fake.sdk, "setAttributes");
  flare.tag("__proto__", "value");

  expect(JSON.stringify(setAttributes.mock.calls.at(-1)?.[1])).toBe(
    '{"__proto__":"value"}',
  );

  flare.tag("__proto__", null);

  expect(JSON.stringify(setAttributes.mock.calls.at(-1)?.[1])).toBe(
    '{"__proto__":""}',
  );
});

test("without the ambient option nothing is ever written to Crashlytics' global state", () => {
  const fake = fakeCrashlytics();
  const flare = new Flare({
    destinations: { crashlytics: crashlytics({ sdk: fake.sdk }) },
  });
  flare.start();

  flare.user({ id: "ada" });
  flare.tag("plan", "pro");
  flare.context("workspace", { id: "w1" });
  flare.breadcrumb("opened");

  expect(fake.state).toMatchObject({ userId: "", logs: [] });
  expect(fake.state.attributes).toEqual({});
  expect(fake.calls).toMatchObject({ setAttributes: 0, setUserId: 0 });
});

test("with no ambient part enabled the session has no ambient member at all", async () => {
  const open = (ambient?: Parameters<typeof crashlytics>[0]["ambient"]) =>
    crashlytics({
      sdk: fakeCrashlytics().sdk,
      ...(ambient === undefined ? {} : { ambient }),
    }).open({ destination: "crashlytics" });

  expect("ambient" in (await open())).toBe(false);
  expect("ambient" in (await open({ tags: false }))).toBe(false);
  expect(typeof (await open({ tags: true })).ambient?.session).toBe("function");
  expect("breadcrumb" in ((await open({ tags: true })).ambient ?? {})).toBe(
    false,
  );
  expect(typeof (await open({ breadcrumbs: true })).ambient?.breadcrumb).toBe(
    "function",
  );
});

test("only the parts that were asked for are mirrored", () => {
  const onlyContexts = create({ contexts: true });
  const onlyUser = create({ user: true });
  const onlyTags = create({ tags: true });
  for (const { flare } of [onlyContexts, onlyUser, onlyTags]) {
    flare.user({ id: "ada" });
    flare.tag("plan", "pro");
    flare.context("workspace", { id: "w1" });
    flare.breadcrumb("opened");
  }

  expect(onlyContexts.fake.state).toMatchObject({ userId: "", logs: [] });
  expect(onlyContexts.fake.state.attributes).toEqual({ "workspace.id": "w1" });
  expect(onlyUser.fake.state).toMatchObject({ userId: "ada", logs: [] });
  expect(onlyUser.fake.state.attributes).toEqual({});
  expect(onlyTags.fake.state).toMatchObject({ userId: "", logs: [] });
  expect(onlyTags.fake.state.attributes).toEqual({ plan: "pro" });
});

test("the user is mirrored as the user id, and signing out can only blank it", () => {
  const { fake, flare } = create({ user: true });

  flare.user({ id: "ada", email: "ada@example.com" });

  expect(fake.state.userId).toBe("ada");
  expect(fake.state.attributes).toEqual({});

  flare.user(null);

  expect(fake.state.userId).toBe("");
});

test("tags and contexts become string keys, with contexts flattened under their name", () => {
  const { fake, flare } = create({ tags: true, contexts: true });

  flare.tag("plan", "pro");
  flare.tag("attempt", 2);
  flare.context("upload", { kind: "avatar", size: 3, nested: { retry: true } });

  expect(fake.state.attributes).toEqual({
    plan: "pro",
    attempt: "2",
    "upload.kind": "avatar",
    "upload.size": "3",
    "upload.nested": '{"retry":true}',
  });
  expect(fake.state.userId).toBe("");
});

test("Crashlytics cannot delete a key, so a removed tag or context is blanked", () => {
  const { fake, flare } = create({ tags: true, contexts: true });
  flare.tag("plan", "pro");
  flare.context("upload", { kind: "avatar", attempt: 1 });

  flare.tag("plan", null);
  flare.context("upload", { attempt: 2 });

  expect(fake.state.attributes).toEqual({
    plan: "",
    "upload.kind": "",
    "upload.attempt": "2",
  });
});

test("an account change blanks every key the previous account left", () => {
  const { fake, flare } = create({ user: true, tags: true, contexts: true });
  flare.user({ id: "ada" });
  flare.tag("plan", "pro");
  flare.context("workspace", { owner: "ada" });

  flare.user({ id: "grace" });

  expect(fake.state.userId).toBe("grace");
  expect(fake.state.attributes).toEqual({ plan: "", "workspace.owner": "" });
});

test("only the first 64 distinct keys are written, and a value is cut at 1024 characters", () => {
  const { fake, flare } = create({ tags: true, contexts: true });
  // The core caps one object at 50 keys, so the overflow takes two contexts.
  const forty = Object.fromEntries(
    Array.from({ length: 40 }, (_, index) => [`key${index}`, index]),
  );

  flare.context("first", forty);
  flare.context("second", forty);
  flare.tag("late", "too late for a slot");

  expect(Object.keys(fake.state.attributes)).toHaveLength(64);
  expect(fake.state.attributes["first.key39"]).toBe("39");
  expect(fake.state.attributes["second.key23"]).toBe("23");
  expect(fake.state.attributes["second.key24"]).toBeUndefined();
  expect(fake.state.attributes.late).toBeUndefined();

  const roomy = create({ tags: true });
  roomy.flare.tag("note", "v".repeat(2_000));

  expect(roomy.fake.state.attributes.note).toHaveLength(1_024);
});

test("a blanked key keeps its slot, because Crashlytics never gives one back", () => {
  const { fake, flare } = create({ tags: true, contexts: true });
  const forty = Object.fromEntries(
    Array.from({ length: 40 }, (_, index) => [`key${index}`, index]),
  );
  flare.context("first", forty);
  flare.context("second", forty);

  flare.context("first", null);
  flare.tag("late", "still no slot");

  expect(fake.state.attributes["first.key0"]).toBe("");
  expect(fake.state.attributes.late).toBeUndefined();
  expect(Object.keys(fake.state.attributes)).toHaveLength(64);
});

test("breadcrumbs become log lines", () => {
  const { fake, flare } = create({ breadcrumbs: true });

  flare.breadcrumb("uploadStarted", { kind: "avatar" });
  flare.breadcrumb("opened");

  expect(fake.state.logs).toEqual([
    'uploadStarted {"kind":"avatar"}',
    "opened",
  ]);
});

test("a native setter that rejects is contained", async () => {
  const unhandled = vi.fn();
  process.on("unhandledRejection", unhandled);
  const { fake, flare } = create({ user: true, tags: true, contexts: true });
  fake.state.rejectSetters = true;

  expect(() => {
    flare.user({ id: "ada" });
    flare.tag("plan", "pro");
  }).not.toThrow();
  await new Promise((resolve) => setTimeout(resolve, 10));
  process.off("unhandledRejection", unhandled);

  expect(unhandled).not.toHaveBeenCalled();
});

test("with user mirroring on, a report for the mirrored user is recorded and carries what Crashlytics attaches", async () => {
  const { fake, flare } = create({
    user: true,
    tags: true,
    contexts: true,
    breadcrumbs: true,
  });
  flare.user({ id: "ada" });
  flare.tag("plan", "pro");
  flare.breadcrumb("opened");

  const status = await flare.capture(new Error("boom")).settled;

  expect(fake.recorded[0]).toMatchObject({
    userId: "ada",
    attributes: { plan: "pro" },
    logs: ["opened"],
  });
  expect(status).toMatchObject({
    outcomes: { crashlytics: { status: "submitted" } },
  });
});

test("with user mirroring on, a report buffered under one account is not recorded under the next", async () => {
  const fake = fakeCrashlytics();
  const flare = new Flare({
    destinations: {
      crashlytics: crashlytics({ sdk: fake.sdk, ambient: { user: true } }),
    },
  });
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

test("with user mirroring on, a report given another user for itself is not recorded under the session's user", async () => {
  const { fake, flare } = create({ user: true });
  flare.user({ id: "ada" });

  const status = await flare.capture(new Error("on behalf of a customer"), {
    user: { id: "customer-7" },
  }).settled;

  expect(status).toMatchObject({
    outcomes: {
      crashlytics: { status: "skipped", reason: "identity-mismatch" },
    },
  });
  expect(fake.recorded).toEqual([]);
});

test("without user mirroring Flare wrote no user, so every report is recorded", async () => {
  const { fake, flare } = create({ tags: true, contexts: true });
  flare.user({ id: "ada" });

  await flare.capture(new Error("boom"), { user: { id: "customer-7" } })
    .settled;

  expect(fake.recorded).toHaveLength(1);
});

test("disposing blanks the user id and every key Flare wrote, and nothing else", () => {
  const { fake, flare } = create({ user: true, tags: true, contexts: true });
  fake.state.attributes.release = "set by the application";
  flare.user({ id: "ada" });
  flare.tag("plan", "pro");

  flare.dispose();

  expect(fake.state.userId).toBe("");
  expect(fake.state.attributes).toEqual({
    release: "set by the application",
    plan: "",
  });
});
