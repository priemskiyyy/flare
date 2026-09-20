import { expect, test } from "vitest";

import type { NormalizedException } from "src/types/NormalizedException";
import { rebuildError } from "src/utils/rebuildError";

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

test("the rebuilt Error carries the sanitized name, message and stack", () => {
  const error = rebuildError(exception());

  expect(error).toBeInstanceOf(Error);
  expect(error).toMatchObject({
    name: "UploadError",
    message: "upload failed",
    stack: "UploadError: upload failed\n    at upload (app.ts:1:1)",
  });
  expect(error.cause).toBeUndefined();
});

test("the cause chain is rebuilt from nearest to furthest", () => {
  const error = rebuildError(
    exception({
      causes: [
        { name: "Error", message: "write failed", stack: null },
        { name: "NonError", message: "disk full", stack: null },
      ],
    }),
  );

  expect(error.cause).toMatchObject({
    message: "write failed",
    cause: { name: "NonError", message: "disk full" },
  });
});

test("a value that had no stack gets a header only, never frames that point at the caller", () => {
  const error = rebuildError(
    exception({ name: "NonError", message: "string rejection", stack: null }),
  );

  expect(error.stack).toBe("NonError: string rejection");
});
