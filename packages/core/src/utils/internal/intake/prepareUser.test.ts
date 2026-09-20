import { expect, test, vi } from "vitest";

import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import { DEFAULT_LIMITS } from "src/utils/constants/limits";
import { prepareUser } from "src/utils/internal/intake/prepareUser";

const policy: PrivacyPolicy = {
  redact: [],
  scrub: null,
  limits: DEFAULT_LIMITS,
};

test("a user keeps its id, email and name", () => {
  expect(
    prepareUser({ id: "u1", email: "ada@example.com", name: "Ada" }, policy),
  ).toEqual({
    user: { id: "u1", email: "ada@example.com", name: "Ada" },
    identity: "u1",
    losses: [],
  });
});

test("null signs the user out", () => {
  expect(prepareUser(null, policy)).toEqual({
    user: null,
    identity: null,
    losses: [],
  });
});

test("bounding the reported id never shortens the identity used for account isolation", () => {
  expect(
    prepareUser(
      { id: "account:first" },
      {
        ...policy,
        limits: { ...policy.limits, stringLength: 8 },
      },
    ),
  ).toEqual({
    user: { id: "account:" },
    identity: "account:first",
    losses: [{ path: "user.id", reason: "truncated" }],
  });
});

test("ignored user fields cannot consume the budget of known identity fields", () => {
  expect(
    prepareUser(
      { extra: "ignored", id: "u1" },
      {
        ...policy,
        limits: { ...policy.limits, breadth: 1 },
      },
    ),
  ).toEqual({ user: { id: "u1" }, identity: "u1", losses: [] });
});

test("an accessor is never accepted as a user id", () => {
  const get = vi.fn(() => "u1");
  const user = Object.defineProperty({}, "id", { get, enumerable: true });

  expect(prepareUser(user, policy)).toEqual({
    user: null,
    identity: null,
    losses: [{ path: "user", reason: "invalid" }],
  });
  expect(get).not.toHaveBeenCalled();
});

test.each([
  { label: "a missing id", user: { email: "ada@example.com" } },
  { label: "an empty id", user: { id: "" } },
  { label: "a numeric id", user: { id: 42 } },
  { label: "a string", user: "u1" },
])(
  "$label signs the user out rather than keeping the previous account",
  (row) => {
    expect(prepareUser(row.user, policy)).toEqual({
      user: null,
      identity: null,
      losses: [{ path: "user", reason: "invalid" }],
    });
  },
);

test("a field that is not a string is dropped and recorded", () => {
  expect(prepareUser({ id: "u1", email: 42 }, policy)).toEqual({
    user: { id: "u1" },
    identity: "u1",
    losses: [{ path: "user.email", reason: "invalid" }],
  });
});

test("anything beyond id, email and name is ignored", () => {
  expect(prepareUser({ id: "u1", role: "admin" }, policy).user).toEqual({
    id: "u1",
  });
});

test("a path rule redacts a field while identity stays keyed on the real id", () => {
  expect(
    prepareUser(
      { id: "u1", email: "ada@example.com" },
      { ...policy, redact: ["user.id", "user.email"] },
    ),
  ).toEqual({
    user: { id: "[Redacted]", email: "[Redacted]" },
    identity: "u1",
    losses: [],
  });
});

test("the scrubber never rewrites deliberate identity fields", () => {
  const scrub = vi.fn((text: string) =>
    text.replace("ada@example.com", "[email]"),
  );

  expect(
    prepareUser({ id: "u1", email: "ada@example.com" }, { ...policy, scrub })
      .user,
  ).toEqual({
    id: "u1",
    email: "ada@example.com",
  });
  expect(scrub).not.toHaveBeenCalled();
});
