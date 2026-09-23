import { expect, test } from "vitest";

import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import type { StandardSchema } from "src/types/StandardSchema";
import { DEFAULT_LIMITS } from "src/utils/constants/limits";
import { prepareBreadcrumb } from "src/utils/internal/intake/prepareBreadcrumb";

const policy: PrivacyPolicy = {
  redact: [],
  scrub: null,
  limits: DEFAULT_LIMITS,
};

const uploadStarted: StandardSchema<Record<string, unknown>> = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) => {
      if (typeof value === "object" && value !== null && "kind" in value) {
        return { value: { kind: value.kind } };
      }

      return { issues: [{ message: "kind is required" }] };
    },
  },
};

test("a breadcrumb keeps its name, sanitized data and occurrence time", () => {
  expect(
    prepareBreadcrumb(
      {
        name: "uploadStarted",
        data: { kind: "avatar", token: "abc" },
        timestamp: 1_000,
      },
      undefined,
      { ...policy, redact: ["token"] },
    ),
  ).toEqual({
    value: {
      name: "uploadStarted",
      data: { kind: "avatar", token: "[Redacted]" },
      timestamp: 1_000,
    },
    losses: [],
  });
});

test("a breadcrumb without data carries null", () => {
  expect(
    prepareBreadcrumb(
      { name: "opened", data: undefined, timestamp: 5 },
      undefined,
      policy,
    ).value,
  ).toEqual({ name: "opened", data: null, timestamp: 5 });
});

test("data that is not an object is rejected", () => {
  expect(
    prepareBreadcrumb(
      { name: "opened", data: "text", timestamp: 5 },
      undefined,
      policy,
    ),
  ).toEqual({
    value: null,
    losses: [{ path: "breadcrumbs.opened", reason: "invalid" }],
  });
});

test("with a schema an undeclared breadcrumb is rejected", () => {
  expect(
    prepareBreadcrumb(
      { name: "clicked", data: {}, timestamp: 5 },
      { uploadStarted },
      policy,
    ),
  ).toEqual({
    value: null,
    losses: [{ path: "breadcrumbs.clicked", reason: "invalid" }],
  });
});

test("with a schema invalid data is rejected and valid data is narrowed", () => {
  expect(
    prepareBreadcrumb(
      { name: "uploadStarted", data: { size: 3 }, timestamp: 5 },
      { uploadStarted },
      policy,
    ).value,
  ).toBeNull();
  expect(
    prepareBreadcrumb(
      {
        name: "uploadStarted",
        data: { kind: "avatar", size: 3 },
        timestamp: 5,
      },
      { uploadStarted },
      policy,
    ).value,
  ).toEqual({ name: "uploadStarted", data: { kind: "avatar" }, timestamp: 5 });
});

test("the prepared breadcrumb is frozen", () => {
  const { value } = prepareBreadcrumb(
    { name: "opened", data: { a: 1 }, timestamp: 5 },
    undefined,
    policy,
  );

  expect(Object.isFrozen(value)).toBe(true);
});

test("a breadcrumb keeps the loss when its entire data exceeds the depth limit", () => {
  expect(
    prepareBreadcrumb(
      { name: "opened", data: { page: "checkout" }, timestamp: 5 },
      undefined,
      { ...policy, limits: { ...policy.limits, depth: 0 } },
    ),
  ).toEqual({
    value: { name: "opened", data: null, timestamp: 5 },
    losses: [{ path: "breadcrumbs.opened", reason: "truncated" }],
  });
});
