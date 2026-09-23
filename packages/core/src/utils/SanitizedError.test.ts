import { expect, test } from "vitest";

import type { NormalizedException } from "src/types/NormalizedException";
import { SanitizedError } from "src/utils/SanitizedError";

const exception = (
  overrides: Partial<NormalizedException> = {},
): NormalizedException => ({
  origin: "error",
  name: "UploadError",
  message: "upload failed",
  stack: "UploadError: upload failed\n    at upload (app.ts:1:1)",
  causes: [],
  aggregated: [],
  ...overrides,
});

test("it is an Error with the sanitized name, message and stack, and no cause of its own", () => {
  const error = new SanitizedError(exception());

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(SanitizedError);
  expect(error).toMatchObject({
    name: "UploadError",
    message: "upload failed",
    stack: "UploadError: upload failed\n    at upload (app.ts:1:1)",
  });
  expect(Object.hasOwn(error, "cause")).toBe(false);
});

test("the cause chain is built from nearest to furthest, each cause a SanitizedError too", () => {
  const error = new SanitizedError(
    exception({
      causes: [
        { name: "Error", message: "write failed", stack: null },
        { name: "NonError", message: "disk full", stack: null },
      ],
    }),
  );

  expect(error.cause).toBeInstanceOf(SanitizedError);
  expect(error.cause).toMatchObject({
    name: "Error",
    message: "write failed",
    cause: { name: "NonError", message: "disk full" },
  });

  const furthest =
    error.cause instanceof Error ? error.cause.cause : "no cause";

  expect(furthest).toBeInstanceOf(SanitizedError);
  expect(Object.hasOwn(Object(furthest), "cause")).toBe(false);
});

test("a value that had no stack gets a header only, never frames that point at the caller", () => {
  const error = new SanitizedError(
    exception({ name: "NonError", message: "string rejection", stack: null }),
  );

  expect(error.stack).toBe("NonError: string rejection");
});

test("a name, a message and a stack are enough, as for a message sent as an error", () => {
  const error = new SanitizedError({
    name: "Message",
    message: "Unexpected payment state",
    stack: null,
  });

  expect(error).toMatchObject({
    name: "Message",
    message: "Unexpected payment state",
    stack: "Message: Unexpected payment state",
  });
});
