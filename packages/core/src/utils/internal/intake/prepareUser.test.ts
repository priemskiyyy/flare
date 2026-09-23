import { expect, test, vi } from "vitest";

import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import { DEFAULT_LIMITS } from "src/utils/constants/limits";
import { prepareUser } from "src/utils/internal/intake/prepareUser";

const policy: PrivacyPolicy = {
  redact: () => false,
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
  const profile = { extra: "ignored", id: "u1" };

  expect(
    prepareUser(profile, {
      ...policy,
      limits: { ...policy.limits, breadth: 1 },
    }),
  ).toEqual({ user: { id: "u1" }, identity: "u1", losses: [] });
});

test("an empty id signs the user out rather than keeping the previous account", () => {
  expect(prepareUser({ id: "" }, policy)).toEqual({
    user: null,
    identity: null,
    losses: [{ path: "user", reason: "invalid" }],
  });
});

test("anything beyond id, email and name is ignored", () => {
  const profile = { id: "u1", role: "admin", password: "hunter2" };

  expect(prepareUser(profile, policy).user).toEqual({ id: "u1" });
});

test("a field the predicate names by its path is redacted, while identity stays keyed on the real id", () => {
  expect(
    prepareUser(
      { id: "u1", email: "ada@example.com" },
      {
        ...policy,
        redact: (_key, path) => path === "user.id" || path === "user.email",
      },
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
