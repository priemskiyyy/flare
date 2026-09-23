import { expect, test, vi } from "vitest";

import { SessionState } from "src/utils/internal/session/SessionState";

const ada = { user: { id: "ada" }, identity: "ada" };
const grace = { user: { id: "grace" }, identity: "grace" };
const signedOut = { user: null, identity: null };
const crumb = (name: string) => ({ name, data: null, timestamp: 1 });

const filled = () => {
  const session = new SessionState({ maxBreadcrumbs: 10 });

  session.identify(ada);
  session.setTag("area", "upload");
  session.setContext("upload", { attempt: 1 });
  session.addBreadcrumb(crumb("opened"));

  return session;
};

test("a session starts anonymous, empty and at generation zero", () => {
  expect(new SessionState({ maxBreadcrumbs: 10 }).state.get()).toEqual({
    generation: 0,
    user: null,
    tags: {},
    contexts: {},
    breadcrumbs: [],
  });
});

test("signing in starts a new identity generation", () => {
  const session = new SessionState({ maxBreadcrumbs: 10 });

  expect(session.identify(ada)).toBe(true);
  expect(session.state.get()).toMatchObject({
    generation: 1,
    user: { id: "ada" },
  });
});

test("new traits under the same id update the user without a new generation", () => {
  const session = filled();

  const changed = session.identify({
    user: { id: "ada", email: "ada@example.com" },
    identity: "ada",
  });

  expect(changed).toBe(false);
  expect(session.state.get()).toEqual({
    generation: 1,
    user: { id: "ada", email: "ada@example.com" },
    tags: { area: "upload" },
    contexts: { upload: { attempt: 1 } },
    breadcrumbs: [crumb("opened")],
  });
});

test("switching account clears everything the previous account left behind", () => {
  const session = filled();

  expect(session.identify(grace)).toBe(true);
  expect(session.state.get()).toEqual({
    generation: 2,
    user: { id: "grace" },
    tags: {},
    contexts: {},
    breadcrumbs: [],
  });
});

test("signing out is an identity change too", () => {
  const session = filled();

  expect(session.identify(signedOut)).toBe(true);
  expect(session.state.get()).toEqual({
    generation: 2,
    user: null,
    tags: {},
    contexts: {},
    breadcrumbs: [],
  });
});

test("signing out while anonymous changes nothing", () => {
  const session = new SessionState({ maxBreadcrumbs: 10 });

  session.addBreadcrumb(crumb("opened"));

  const before = session.state.get();

  expect(session.identify(signedOut)).toBe(false);
  expect(session.state.get()).toBe(before);
  expect(session.state.get()).toMatchObject({
    generation: 0,
    breadcrumbs: [crumb("opened")],
  });
});

test("unchanged metadata preserves the snapshot and does not notify observers", () => {
  const session = filled();
  const before = session.state.get();
  const listener = vi.fn();

  session.state.subscribe(listener);

  session.identify({ user: { id: "ada" }, identity: "ada" });
  session.setTag("area", "upload");
  session.removeTag("missing");
  session.removeContext("missing");

  expect(session.state.get()).toBe(before);
  expect(listener).not.toHaveBeenCalled();
});

test("identity follows the real id even when the visible user is redacted", () => {
  const session = new SessionState({ maxBreadcrumbs: 10 });

  session.identify({ user: { id: "[Redacted]" }, identity: "ada" });

  expect(
    session.identify({ user: { id: "[Redacted]" }, identity: "grace" }),
  ).toBe(true);
  expect(session.state.get().generation).toBe(2);
});

test("tags are set independently and a tag can be removed", () => {
  const session = new SessionState({ maxBreadcrumbs: 10 });

  session.setTag("area", "upload");
  session.setTag("plan", "pro");
  session.setTag("area", "editor");
  session.removeTag("plan");

  expect(session.state.get().tags).toEqual({ area: "editor" });
});

test("a context is replaced by name, never merged with its previous value", () => {
  const session = new SessionState({ maxBreadcrumbs: 10 });

  session.setContext("upload", { kind: "avatar", attempt: 1 });
  session.setContext("upload", { attempt: 2 });

  expect(session.state.get().contexts).toEqual({ upload: { attempt: 2 } });

  session.removeContext("upload");

  expect(session.state.get().contexts).toEqual({});
});

test("breadcrumbs beyond the limit push the oldest out", () => {
  const session = new SessionState({ maxBreadcrumbs: 2 });

  session.addBreadcrumb(crumb("first"));
  session.addBreadcrumb(crumb("second"));
  session.addBreadcrumb(crumb("third"));

  expect(session.state.get().breadcrumbs.map((entry) => entry.name)).toEqual([
    "second",
    "third",
  ]);
});

test("a zero breadcrumb limit retains no history", () => {
  const session = new SessionState({ maxBreadcrumbs: 0 });

  session.addBreadcrumb(crumb("first"));
  session.addBreadcrumb(crumb("second"));

  expect(session.state.get().breadcrumbs).toEqual([]);
});

test("a snapshot taken earlier never changes, whatever the session does next", () => {
  const session = filled();
  const before = session.state.get();

  session.setTag("area", "editor");
  session.setContext("upload", { attempt: 9 });
  session.addBreadcrumb(crumb("later"));
  session.identify(grace);

  expect(before).toEqual({
    generation: 1,
    user: { id: "ada" },
    tags: { area: "upload" },
    contexts: { upload: { attempt: 1 } },
    breadcrumbs: [crumb("opened")],
  });
  expect(Object.isFrozen(before)).toBe(true);
  expect(Object.isFrozen(before.tags)).toBe(true);
  expect(Object.isFrozen(before.breadcrumbs)).toBe(true);
});

test("observers hear about every change", () => {
  const session = new SessionState({ maxBreadcrumbs: 10 });
  const listener = vi.fn();

  session.state.subscribe(listener);

  session.setTag("area", "upload");
  session.identify(ada);

  expect(listener).toHaveBeenCalledTimes(2);
});

test("methods stay bound when passed around", () => {
  const { identify, setTag, state } = new SessionState({ maxBreadcrumbs: 10 });

  identify(ada);
  setTag("area", "upload");

  expect(state.get()).toMatchObject({
    generation: 1,
    tags: { area: "upload" },
  });
});
