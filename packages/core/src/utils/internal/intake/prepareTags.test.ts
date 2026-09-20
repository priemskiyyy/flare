import { expect, test } from "vitest";

import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import type { StandardSchema } from "src/types/StandardSchema";
import type { TagValue } from "src/types/TagValue";
import { DEFAULT_LIMITS } from "src/utils/constants/limits";
import { prepareTags } from "src/utils/internal/intake/prepareTags";

const policy: PrivacyPolicy = {
  redact: [],
  scrub: null,
  limits: DEFAULT_LIMITS,
};

const area: StandardSchema<TagValue> = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) => {
      if (value === "upload" || value === "editor") {
        return { value };
      }
      return { issues: [{ message: "unknown area" }] };
    },
  },
};

test("without a schema every scalar tag is kept", () => {
  expect(
    prepareTags({ area: "upload", attempt: 2, retry: true }, undefined, policy),
  ).toEqual({
    value: { area: "upload", attempt: 2, retry: true },
    losses: [],
  });
});

test("a tag that is not scalar is dropped and recorded", () => {
  expect(
    prepareTags({ area: "upload", nested: { no: true } }, undefined, policy),
  ).toEqual({
    value: { area: "upload" },
    losses: [{ path: "tags.nested", reason: "invalid" }],
  });
});

test("a number that is not finite is not a usable tag", () => {
  expect(prepareTags({ ratio: Number.NaN }, undefined, policy).losses).toEqual([
    { path: "tags.ratio", reason: "invalid" },
  ]);
});

test("with a schema a declared tag is validated", () => {
  expect(prepareTags({ area: "billing" }, { area }, policy)).toEqual({
    value: {},
    losses: [{ path: "tags.area", reason: "invalid" }],
  });
});

test("with a schema an undeclared tag is rejected while valid ones survive", () => {
  expect(
    prepareTags({ area: "editor", plan: "pro" }, { area }, policy),
  ).toEqual({
    value: { area: "editor" },
    losses: [{ path: "tags.plan", reason: "invalid" }],
  });
});

test("a tag named by a redaction rule is redacted, not dropped", () => {
  expect(
    prepareTags({ sessionToken: "abc", area: "upload" }, undefined, {
      ...policy,
      redact: [/token/i],
    }).value,
  ).toEqual({ sessionToken: "[Redacted]", area: "upload" });
});

test("string tags pass through the scrubber", () => {
  const scrub = (text: string) => text.replace("ada@example.com", "[email]");

  expect(
    prepareTags({ owner: "ada@example.com" }, undefined, { ...policy, scrub })
      .value,
  ).toEqual({
    owner: "[email]",
  });
});

test("the prepared tags are frozen", () => {
  expect(
    Object.isFrozen(prepareTags({ area: "upload" }, undefined, policy).value),
  ).toBe(true);
});
