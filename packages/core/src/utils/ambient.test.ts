import { expect, test } from "vitest";

import { createReporterAdapter } from "src/generators/createReporterAdapter";
import { createMockAdapter } from "src/mock/createMockAdapter";
import { Flare } from "src/utils/Flare";

test("an ambient integration mirrors sanitized session state, and only when it changes", () => {
  const mock = createMockAdapter({ ambient: true });
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  flare.user({ id: "ada" });
  flare.tag("plan", "pro");
  flare.context("request", { password: "hunter2" });
  flare.breadcrumb("opened");
  flare.breadcrumb("clicked");

  expect(mock.sessions[0]?.ambient.sessions).toEqual([
    { generation: 0, user: null, tags: {}, contexts: {} },
    { generation: 1, user: { id: "ada" }, tags: {}, contexts: {} },
    { generation: 1, user: { id: "ada" }, tags: { plan: "pro" }, contexts: {} },
    {
      generation: 1,
      user: { id: "ada" },
      tags: { plan: "pro" },
      contexts: { request: { password: "[Redacted]" } },
    },
  ]);
  expect(
    mock.sessions[0]?.ambient.breadcrumbs.map((entry) => entry.name),
  ).toEqual(["opened", "clicked"]);
});

test("signing out is mirrored, so provider globals stop naming the previous account", () => {
  const mock = createMockAdapter({ ambient: true });
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();
  flare.user({ id: "ada" });
  flare.tag("plan", "pro");

  flare.user(null);

  expect(mock.sessions[0]?.ambient.sessions.at(-1)).toEqual({
    generation: 2,
    user: null,
    tags: {},
    contexts: {},
  });
});

test("unchanged user traits, tags and missing removals do not repeat ambient updates", () => {
  const mock = createMockAdapter({ ambient: true });
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();
  flare.user({ id: "ada", name: "Ada" });
  flare.tag("attempt", 0);
  flare.tag("enabled", false);
  flare.tag("label", "");
  flare.tag("__proto__", "own tag");

  const updates = mock.sessions[0]?.ambient.sessions.length;

  flare.user({ id: "ada", name: "Ada" });
  flare.tag("attempt", 0);
  flare.tag("enabled", false);
  flare.tag("label", "");
  flare.tag("__proto__", "own tag");
  flare.tag("missing", null);
  flare.tag("toString", null);
  flare.context("missing", null);
  flare.context("__proto__", null);

  expect(mock.sessions[0]?.ambient.sessions).toHaveLength(updates ?? -1);
  flare.dispose();
});

test("echoing a session tag from a provider stops after the actual change", () => {
  const mock = createMockAdapter({ ambient: true });
  let echoes = 0;

  const flare = new Flare({
    destinations: {
      first: createReporterAdapter({
        name: "echo",
        capabilities: mock.adapter.capabilities,
        open: () => ({
          native: null,
          submit: () => ({
            status: "submitted",
            evidence: "sdk-call-returned",
          }),
          ambient: {
            session: (snapshot) => {
              if (snapshot.tags.area !== "upload") {
                return;
              }

              echoes += 1;

              // Bound a broken implementation so the failure does not overflow the stack.
              if (echoes < 3) {
                flare.tag("area", "upload");
              }
            },
          },
        }),
      }),
      second: mock.adapter,
    },
  });

  flare.start();

  flare.tag("area", "upload");

  expect(echoes).toBe(1);
  expect(mock.sessions[0]?.ambient.sessions.at(-1)?.tags).toEqual({
    area: "upload",
  });
  flare.dispose();
});

test("event-local metadata never reaches the ambient integration", () => {
  const mock = createMockAdapter({ ambient: true });
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  const before = mock.sessions[0]?.ambient.sessions.length;

  flare.capture(new Error("boom"), {
    tags: { area: "upload" },
    contexts: { upload: { attempt: 1 } },
    user: { id: "event-local" },
  });
  flare.scope({ tags: { area: "editor" } }).capture(new Error("scoped"));

  expect(mock.sessions[0]?.ambient.sessions).toHaveLength(before ?? -1);
});

test.each(["session", "breadcrumb"])(
  "an account switch in an ambient %s callback stops the previous account reaching later providers",
  (callback) => {
    const mock = createMockAdapter({ ambient: true });

    const flare = new Flare({
      destinations: {
        first: createReporterAdapter({
          name: "first",
          capabilities: mock.adapter.capabilities,
          open: () => ({
            native: null,
            submit: () => ({
              status: "submitted",
              evidence: "sdk-call-returned",
            }),
            ambient: {
              session: (snapshot) => {
                if (callback === "session" && snapshot.user?.id === "ada") {
                  flare.user({ id: "grace" });
                }
              },
              breadcrumb: () => {
                if (callback === "breadcrumb") {
                  flare.user({ id: "grace" });
                }
              },
            },
          }),
        }),
        second: mock.adapter,
      },
    });

    flare.start();

    flare.user({ id: "ada" });

    if (callback === "breadcrumb") {
      flare.breadcrumb("ada opened checkout");
    }

    expect(mock.sessions[0]?.ambient.sessions.at(-1)?.user).toEqual({
      id: "grace",
    });
    expect(mock.sessions[0]?.ambient.breadcrumbs).toEqual([]);
    flare.dispose();
  },
);

test("a nested metadata update reaches every provider without being overwritten by the older snapshot", () => {
  const mock = createMockAdapter({ ambient: true });

  const flare = new Flare({
    destinations: {
      first: createReporterAdapter({
        name: "first",
        capabilities: mock.adapter.capabilities,
        open: () => ({
          native: null,
          submit: () => ({
            status: "submitted",
            evidence: "sdk-call-returned",
          }),
          ambient: {
            session: (snapshot) => {
              if (snapshot.tags.plan === "pro") {
                flare.tag("plan", "team");
              }
            },
          },
        }),
      }),
      second: mock.adapter,
    },
  });

  flare.start();

  flare.tag("plan", "pro");

  expect(mock.sessions[0]?.ambient.sessions.at(-1)?.tags).toEqual({
    plan: "team",
  });
  flare.dispose();
});

test("a provider cannot replace the ambient snapshot another provider receives", () => {
  const mock = createMockAdapter({ ambient: true });
  const writes: boolean[] = [];

  const flare = new Flare({
    destinations: {
      first: createReporterAdapter({
        name: "mutating",
        capabilities: mock.adapter.capabilities,
        open: () => ({
          native: null,
          submit: () => ({
            status: "submitted",
            evidence: "sdk-call-returned",
          }),
          ambient: {
            session: (snapshot) => {
              writes.push(
                Reflect.set(snapshot, "user", { id: "another account" }),
              );
              writes.push(
                Reflect.set(snapshot, "tags", { source: "provider" }),
              );
            },
          },
        }),
      }),
      second: mock.adapter,
    },
  });

  flare.start();
  flare.user({ id: "ada" });
  flare.tag("area", "upload");

  expect(mock.sessions[0]?.ambient.sessions.at(-1)).toEqual({
    generation: 1,
    user: { id: "ada" },
    tags: { area: "upload" },
    contexts: {},
  });
  expect(writes).toEqual([false, false, false, false, false, false]);
  flare.dispose();
});

test("an ambient integration that throws cannot break a session change", () => {
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: {
      primary: {
        ...mock.adapter,
        open: () => ({
          native: null,
          submit: () => ({
            status: "submitted",
            evidence: "sdk-call-returned",
            event: null,
            losses: [],
          }),
          ambient: {
            session: () => {
              throw new Error("provider global rejected");
            },
          },
          dispose: () => {},
        }),
      },
    },
  });

  expect(() => {
    flare.start();
    flare.user({ id: "ada" });
  }).not.toThrow();
});

test("ambient promise rejections are diagnosed and do not interrupt reporting", async () => {
  const mock = createMockAdapter();
  const rejected = Promise.reject(new Error("provider global rejected"));

  // Keep a broken implementation from turning this assertion into an unhandled rejection.
  rejected.catch(() => {});

  const flare = new Flare({
    destinations: {
      primary: createReporterAdapter({
        name: "ambient",
        capabilities: mock.adapter.capabilities,
        open: () => ({
          native: null,
          submit: () => ({
            status: "submitted",
            evidence: "sdk-call-returned",
          }),
          ambient: {
            session: () => rejected,
            breadcrumb: () => rejected,
          },
        }),
      }),
    },
  });

  const events: string[] = [];

  flare.diagnostics.events.subscribe((event) => events.push(event.type));

  flare.start();
  flare.breadcrumb("opened");

  const status = await flare.message("still reporting").settled;

  expect(events.filter((type) => type.endsWith("failed"))).toEqual([
    "ambient session failed",
    "ambient breadcrumb failed",
  ]);
  expect(status).toMatchObject({
    outcomes: { primary: { status: "submitted" } },
  });
  flare.dispose();
});

test("unreadable ambient methods are diagnosed without stranding buffered reports", () => {
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: {
      primary: {
        ...mock.adapter,
        open: () => ({
          native: null,
          submit: () => ({
            status: "submitted" as const,
            evidence: "sdk-call-returned" as const,
          }),
          ambient: {
            get session(): never {
              throw new Error("unreadable session mirror");
            },
            get breadcrumb(): never {
              throw new Error("unreadable breadcrumb mirror");
            },
          },
          dispose: () => {},
        }),
      },
    },
  });

  const events: string[] = [];

  flare.diagnostics.events.subscribe((event) => events.push(event.type));

  const receipt = flare.message("buffered");

  flare.start();
  flare.breadcrumb("opened");

  const status = receipt.status.get();

  flare.dispose();

  expect(events).toContain("ambient session failed");
  expect(events).toContain("ambient breadcrumb failed");
  expect(status).toMatchObject({
    outcomes: { primary: { status: "submitted" } },
  });
});
