import { expect, test } from "vitest";

import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import type { StandardSchema } from "src/types/StandardSchema";
import { DEFAULT_LIMITS } from "src/utils/constants/limits";
import { prepareContexts } from "src/utils/internal/intake/prepareContexts";

const policy: PrivacyPolicy = {
  redact: [],
  scrub: null,
  limits: DEFAULT_LIMITS,
};

const upload: StandardSchema<Record<string, unknown>> = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) => {
      if (typeof value === "object" && value !== null && "attempt" in value) {
        return { value: { attempt: value.attempt } };
      }
      return { issues: [{ message: "attempt is required" }] };
    },
  },
};

test("without a schema every named object is kept and sanitized", () => {
  expect(
    prepareContexts({ upload: { attempt: 1, password: "x" } }, undefined, {
      ...policy,
      redact: ["password"],
    }),
  ).toEqual({
    value: { upload: { attempt: 1, password: "[Redacted]" } },
    losses: [],
  });
});

test.each([
  { label: "a string", context: "text" },
  { label: "an array", context: [1, 2] },
  { label: "null", context: null },
])("a context that is $label is dropped and recorded", (row) => {
  expect(prepareContexts({ upload: row.context }, undefined, policy)).toEqual({
    value: {},
    losses: [{ path: "contexts.upload", reason: "invalid" }],
  });
});

test("with a schema the validated output is what is kept", () => {
  expect(
    prepareContexts(
      { upload: { attempt: 2, extra: "stripped" } },
      { upload },
      policy,
    ).value,
  ).toEqual({ upload: { attempt: 2 } });
});

test("with a schema an invalid or undeclared context is rejected", () => {
  expect(
    prepareContexts(
      { upload: { kind: "avatar" }, workspace: { id: "w1" } },
      { upload },
      policy,
    ),
  ).toEqual({
    value: {},
    losses: [
      { path: "contexts.upload", reason: "invalid" },
      { path: "contexts.workspace", reason: "invalid" },
    ],
  });
});

test("a context redacted as a whole by a path rule is left out", () => {
  expect(
    prepareContexts(
      { billing: { card: "4242" }, upload: { attempt: 1 } },
      undefined,
      {
        ...policy,
        redact: ["contexts.billing"],
      },
    ),
  ).toEqual({ value: { upload: { attempt: 1 } }, losses: [] });
});

test("truncation inside a context is reported with its path", () => {
  const { losses } = prepareContexts(
    { upload: { note: "n".repeat(30) } },
    undefined,
    {
      ...policy,
      limits: { ...DEFAULT_LIMITS, stringLength: 5 },
    },
  );

  expect(losses).toEqual([
    { path: "contexts.upload.note", reason: "truncated" },
  ]);
});
