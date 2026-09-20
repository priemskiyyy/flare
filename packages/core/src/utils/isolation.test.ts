import { expect, test } from "vitest";

import { createMockAdapter } from "src/mock/createMockAdapter";
import type { SanitizedReport } from "src/types/SanitizedReport";
import { Flare } from "src/utils/Flare";

const create = (options: Parameters<typeof createMockAdapter>[0] = {}) => {
  const mock = createMockAdapter(options);
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  flare.start();
  return { mock, flare };
};

const reports = (mock: ReturnType<typeof createMockAdapter>) =>
  mock.submissions.map((submission) => submission.report);

test.each(["route", "destination"])(
  "a %s cannot rewrite exception data or losses seen by another destination",
  (callback) => {
    const writes: boolean[] = [];
    const rewrite = (report: SanitizedReport) => {
      if (report.kind !== "exception") {
        return;
      }
      for (const error of [
        report.exception,
        ...report.exception.causes,
        ...report.exception.aggregated,
      ]) {
        writes.push(Reflect.set(error, "message", "changed"));
      }
      writes.push(Reflect.set(report.exception.causes, "length", 0));
      writes.push(Reflect.set(report.exception.aggregated, "length", 0));
      for (const loss of report.losses) {
        writes.push(Reflect.set(loss, "path", "changed"));
      }
    };
    const first = createMockAdapter({
      onSubmit: ({ report }) => {
        if (callback === "destination") {
          rewrite(report);
        }
      },
    });
    const second = createMockAdapter();
    const flare = new Flare({
      destinations: { first: first.adapter, second: second.adapter },
      privacy: { limits: { messageLength: 3 } },
      route: ({ report }) => {
        if (callback === "route") {
          rewrite(report);
        }
        return ["first", "second"];
      },
    });
    const cause = new Error("cause");
    const member = new Error("member");
    const error = new AggregateError([member], "outer", { cause });
    flare.start();

    flare.capture(error);

    expect(reports(second)[0]).toMatchObject({
      exception: {
        message: "out",
        causes: [{ message: "cau" }],
        aggregated: [{ message: "mem" }],
      },
      losses: [
        { path: "exception.message", reason: "truncated" },
        { path: "exception.causes.0.message", reason: "truncated" },
        { path: "exception.aggregated.0.message", reason: "truncated" },
      ],
    });
    expect(writes).toEqual(Array(8).fill(false));
    expect(error.message).toBe("outer");
    expect(Object.isFrozen(error)).toBe(false);
    expect(Object.isFrozen(cause)).toBe(false);
    expect(Object.isFrozen(member)).toBe(false);
    flare.dispose();
  },
);

test("concurrent reports never see each other's event-local context", () => {
  const { mock, flare } = create({ hold: true });

  flare.capture(new Error("upload"), {
    tags: { area: "upload" },
    contexts: { upload: { attempt: 1 } },
    user: { id: "upload-user" },
  });
  flare.capture(new Error("editor"), {
    tags: { area: "editor" },
    contexts: { editor: { document: "d1" } },
  });
  flare.capture(new Error("plain"));

  expect(
    reports(mock).map((report) => [
      report.tags,
      report.contexts,
      report.identity.user,
    ]),
  ).toEqual([
    [{ area: "upload" }, { upload: { attempt: 1 } }, { id: "upload-user" }],
    [{ area: "editor" }, { editor: { document: "d1" } }, null],
    [{}, {}, null],
  ]);
});

test("event-local metadata never changes the session", () => {
  const { mock, flare } = create();
  flare.tag("plan", "pro");

  flare.capture(new Error("scoped"), {
    tags: { plan: "override", area: "upload" },
  });
  flare.capture(new Error("after"));

  expect(reports(mock)[1]?.tags).toEqual({ plan: "pro" });
});

test("a report keeps the context it was captured with, whatever the session does while it is pending", () => {
  const { mock, flare } = create({ hold: true });
  flare.user({ id: "ada" });
  flare.tag("area", "upload");
  flare.breadcrumb("opened");

  const receipt = flare.capture(new Error("pending"));
  flare.user({ id: "grace" });
  flare.tag("area", "editor");
  flare.breadcrumb("switched");

  expect(reports(mock)[0]).toMatchObject({
    identity: { generation: 1, user: { id: "ada" } },
    tags: { area: "upload" },
    breadcrumbs: [{ name: "opened" }],
  });
  expect(receipt.status.get().state).toBe("pending");
});

test.each(["direct", "scope"])(
  "a %s report keeps its account when a scrubber changes the session during intake",
  (source) => {
    const mock = createMockAdapter();
    const flare = new Flare({
      destinations: { primary: mock.adapter },
      privacy: {
        scrub: (text) => {
          if (text === "switch during intake") {
            flare.user({ id: "account:grace" });
            flare.tag("owner", "grace");
          }
          return text;
        },
      },
    });
    flare.start();
    flare.user({ id: "account:ada" });
    flare.tag("owner", "ada");
    flare.breadcrumb("ada opened checkout");
    const reporter =
      source === "scope" ? flare.scope({ operation: "checkout" }) : flare;

    reporter.message("switch during intake");
    flare.message("next report");

    expect(reports(mock)[0]).toMatchObject({
      identity: { generation: 1, user: { id: "account:ada" } },
      tags: { owner: "ada" },
      breadcrumbs: [{ name: "ada opened checkout" }],
    });
    expect(reports(mock)[1]).toMatchObject({
      identity: { generation: 2, user: { id: "account:grace" } },
      tags: { owner: "grace" },
      breadcrumbs: [],
    });
  },
);

test.each(["user", "tag", "context", "breadcrumb"])(
  "a %s prepared across an account switch cannot enter the new session",
  (field) => {
    const mock = createMockAdapter({ ambient: true });
    const flare = new Flare({
      destinations: { primary: mock.adapter },
      privacy: {
        limits: { stringLength: 16 },
        scrub: (text) => {
          if (text === "ada data") {
            flare.user({ id: "account:grace" });
          }
          return text;
        },
      },
    });
    flare.diagnostics.events.subscribe((event) => {
      if (field === "user" && event.type === "session losses") {
        flare.user({ id: "account:grace" });
      }
    });
    flare.start();
    flare.user({ id: "account:ada" });

    if (field === "user") {
      flare.user({ id: "ada data", email: "ada.long@example.com" });
    }
    if (field === "tag") {
      flare.tag("owner", "ada data");
    }
    if (field === "context") {
      flare.context("workspace", { owner: "ada data" });
    }
    if (field === "breadcrumb") {
      flare.breadcrumb("opened", { owner: "ada data" });
    }
    flare.message("next report");

    expect(reports(mock)[0]).toMatchObject({
      identity: { generation: 2, user: { id: "account:grace" } },
    });
    expect(reports(mock)[0]?.tags).toEqual({});
    expect(reports(mock)[0]?.contexts).toEqual({});
    expect(reports(mock)[0]?.breadcrumbs).toEqual([]);
    expect(mock.sessions[0]?.ambient.breadcrumbs).toEqual([]);
  },
);

test("an account switch clears what the previous account left behind, but not application defaults", () => {
  const mock = createMockAdapter();
  const flare = new Flare({
    destinations: { primary: mock.adapter },
    defaults: { tags: { app: "web" }, contexts: { device: { model: "x" } } },
  });
  flare.start();
  flare.user({ id: "ada" });
  flare.tag("plan", "pro");
  flare.context("workspace", { id: "ada-workspace" });
  flare.breadcrumb("ada-opened-billing");

  flare.user({ id: "grace" });
  flare.capture(new Error("as grace"));

  expect(reports(mock)[0]).toMatchObject({
    identity: { generation: 2, user: { id: "grace" } },
    tags: { app: "web" },
    contexts: { device: { model: "x" } },
    breadcrumbs: [],
  });
  expect(JSON.stringify(reports(mock)[0])).not.toContain("ada");
});

test("a scope created before an account switch is stale and adopts nobody", async () => {
  const { mock, flare } = create();
  flare.user({ id: "ada" });
  const upload = flare.scope({ tags: { area: "upload" } });

  flare.user({ id: "grace" });
  const receipt = upload.capture(new Error("finished after the switch"));

  await expect(receipt.settled).resolves.toEqual({
    state: "dropped",
    reason: "stale-scope",
  });
  expect(mock.submissions).toEqual([]);
});

test("accounts whose reported ids share a truncated prefix still have separate sessions", async () => {
  const mock = createMockAdapter();
  const flare = new Flare({
    destinations: { primary: mock.adapter },
    privacy: { limits: { stringLength: 8 } },
  });
  flare.start();
  flare.user({ id: "account:first" });
  flare.tag("owner", "first");
  flare.context("cart", { owner: "first" });
  flare.breadcrumb("opened");
  const scope = flare.scope({});

  flare.user({ id: "account:second" });
  flare.message("current");

  expect(reports(mock)[0]).toMatchObject({
    identity: { generation: 2, user: { id: "account:" } },
  });
  expect(reports(mock)[0]?.tags).toEqual({});
  expect(reports(mock)[0]?.contexts).toEqual({});
  expect(reports(mock)[0]?.breadcrumbs).toEqual([]);
  await expect(scope.message("stale").settled).resolves.toEqual({
    state: "dropped",
    reason: "stale-scope",
  });
});

test("logging out makes an old asynchronous scope stale too", async () => {
  const { mock, flare } = create();
  flare.user({ id: "ada" });
  const upload = flare.scope({ operation: "upload-avatar" });

  flare.user(null);

  await expect(upload.message("upload finished late").settled).resolves.toEqual(
    {
      state: "dropped",
      reason: "stale-scope",
    },
  );
  expect(mock.submissions).toEqual([]);
});

test("a scope stays usable while its identity lasts, and composes under capture options", () => {
  const { mock, flare } = create();
  flare.user({ id: "ada" });
  flare.tag("area", "session");
  const upload = flare.scope({
    tags: { area: "upload" },
    contexts: { upload: { attempt: 1 } },
    operation: "upload-avatar",
  });

  flare.user({ id: "ada", email: "ada@example.com" });
  upload.capture(new Error("first"));
  upload.capture(new Error("second"), {
    tags: { attempt: 2 },
    operation: null,
  });

  expect(reports(mock)[0]).toMatchObject({
    tags: { area: "upload" },
    contexts: { upload: { attempt: 1 } },
    operation: "upload-avatar",
    identity: { user: { id: "ada", email: "ada@example.com" } },
  });
  expect(reports(mock)[1]).toMatchObject({
    tags: { area: "upload", attempt: 2 },
    operation: null,
  });
});

test("aggressively interleaved users, scopes and captures never leak across accounts", () => {
  const { mock, flare } = create({ hold: true });
  // A bare name like "ada" can occur by chance in the report's hexadecimal UUID.
  const accounts = [
    "account:ada",
    "account:grace",
    "account:linus",
    "account:barbara",
  ];

  for (const [round, account] of accounts.entries()) {
    flare.user({ id: account });
    flare.tag("owner", account);
    flare.context("workspace", { owner: account });
    flare.breadcrumb(`${account}-step`);
    const scope = flare.scope({ tags: { scopeOwner: account } });
    scope.capture(new Error(`${account}-scoped`));
    flare.capture(new Error(`${account}-plain`), {
      contexts: { local: { round } },
    });
    flare.message(`${account}-message`);
  }

  expect(reports(mock)).toHaveLength(12);
  for (const report of reports(mock)) {
    const owner = report.identity.user?.id ?? "";
    const others = accounts.filter((account) => account !== owner);
    const serialized = JSON.stringify(report);

    expect(report.tags.owner).toBe(owner);
    expect(report.contexts.workspace).toEqual({ owner });
    expect(report.breadcrumbs.map((entry) => entry.name)).toEqual([
      `${owner}-step`,
    ]);
    expect(others.filter((other) => serialized.includes(other))).toEqual([]);
  }
});

test("a breadcrumb can carry the time it occurred, which is not always the time it was recorded", () => {
  const mock = createMockAdapter();
  const flare = new Flare({
    destinations: { primary: mock.adapter },
    now: () => 5_000,
  });
  flare.start();

  flare.breadcrumb("recorded-now");
  flare.breadcrumb("occurred-earlier", { step: 1 }, { timestamp: 4_200 });
  flare.capture(new Error("boom"));

  expect(reports(mock)[0]?.breadcrumbs).toEqual([
    { name: "recorded-now", data: null, timestamp: 5_000 },
    { name: "occurred-earlier", data: { step: 1 }, timestamp: 4_200 },
  ]);
});

test.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
  "an occurrence time of %s is not usable, so the breadcrumb is recorded as of now",
  (timestamp) => {
    const mock = createMockAdapter();
    const flare = new Flare({
      destinations: { primary: mock.adapter },
      now: () => 5_000,
    });
    flare.start();

    flare.breadcrumb("odd", undefined, { timestamp });
    flare.capture(new Error("boom"));

    expect(reports(mock)[0]?.breadcrumbs).toEqual([
      { name: "odd", data: null, timestamp: 5_000 },
    ]);
  },
);

test("a breadcrumb that occurred before the current identity began is not kept", () => {
  let clock = 1_000;
  const mock = createMockAdapter();
  const flare = new Flare({
    destinations: { primary: mock.adapter },
    now: () => clock,
  });
  flare.start();
  flare.user({ id: "ada" });
  clock = 2_000;
  flare.user({ id: "grace" });
  clock = 2_500;

  flare.breadcrumb(
    "ada-checkout-started",
    { cart: "ada-cart" },
    { timestamp: 1_500 },
  );
  flare.breadcrumb("grace-opened-editor", undefined, { timestamp: 2_000 });
  flare.breadcrumb("grace-saved", undefined, { timestamp: 2_400 });
  flare.capture(new Error("as grace"));

  expect(reports(mock)[0]?.breadcrumbs.map((entry) => entry.name)).toEqual([
    "grace-opened-editor",
    "grace-saved",
  ]);
  expect(JSON.stringify(reports(mock)[0])).not.toContain("ada");
});

test("a breadcrumb recorded now is kept even when the wall clock steps backwards", () => {
  // Date.now is not monotonic. A breadcrumb recorded now belongs to the
  // current identity by definition, whatever the clock says.
  const readings = [1_000, 999, 999];
  const mock = createMockAdapter();
  const flare = new Flare({
    destinations: { primary: mock.adapter },
    now: () => readings.shift() ?? 999,
  });
  flare.start();
  flare.user({ id: "ada" });

  flare.breadcrumb("opened");
  flare.capture(new Error("boom"));

  expect(reports(mock)[0]?.breadcrumbs.map((entry) => entry.name)).toEqual([
    "opened",
  ]);
});
