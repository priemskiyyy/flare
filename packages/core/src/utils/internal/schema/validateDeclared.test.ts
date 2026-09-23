import { expect, test, vi } from "vitest";

import type { StandardSchema } from "src/types/StandardSchema";
import { validateDeclared } from "src/utils/internal/schema/validateDeclared";

const validate = (schema: StandardSchema, value: unknown) =>
  validateDeclared({ value: schema }, "value", value);

const schemaOf = <TValue>(
  validate: StandardSchema<TValue>["~standard"]["validate"],
): StandardSchema<TValue> => ({
  "~standard": { version: 1, vendor: "test", validate },
});

const area = schemaOf<"upload" | "editor">((value) => {
  if (value === "upload" || value === "editor") {
    return { value };
  }

  return { issues: [{ message: "expected upload or editor" }] };
});

test("a valid value is accepted", () => {
  expect(validate(area, "upload")).toEqual({
    valid: true,
    value: "upload",
  });
});

test("the validator's output replaces the input, so transforms apply", () => {
  const trimmed = schemaOf<string>((value) => ({
    value: String(value).trim(),
  }));

  expect(validate(trimmed, "  padded  ")).toEqual({
    valid: true,
    value: "padded",
  });
});

test("an invalid value is rejected", () => {
  expect(validate(area, "billing")).toEqual({
    valid: false,
  });
});

test("an asynchronous validator is rejected, because capture is synchronous", () => {
  const asynchronous = schemaOf<string>(() =>
    Promise.resolve({ value: "late" }),
  );

  expect(validate(asynchronous, "anything")).toEqual({
    valid: false,
  });
});

test("an asynchronous validator that rejects leaves no unhandled rejection", async () => {
  const unhandled = vi.fn();

  process.on("unhandledRejection", unhandled);

  const rejecting = schemaOf<string>(() =>
    Promise.reject(new Error("late failure")),
  );

  validate(rejecting, "anything");
  await new Promise((resolve) => setTimeout(resolve, 10));
  process.off("unhandledRejection", unhandled);

  expect(unhandled).not.toHaveBeenCalled();
});

test("a validator that throws is a rejection, not a crash", () => {
  const throwing = schemaOf<string>(() => {
    throw new Error("validator exploded");
  });

  expect(validate(throwing, "anything")).toEqual({
    valid: false,
  });
});

test("a validator keeps its receiver", () => {
  const standard = {
    version: 1 as const,
    vendor: "test",
    validate(value: unknown) {
      expect(this).toBe(standard);

      return { value };
    },
  };

  expect(validate({ "~standard": standard }, "accepted")).toEqual({
    valid: true,
    value: "accepted",
  });
});

test("an unreadable schema costs only the field being validated", () => {
  const schema: StandardSchema = {
    get "~standard"(): never {
      throw new Error("unreadable schema");
    },
  };

  expect(validate(schema, "anything")).toEqual({ valid: false });
});

test("an unreadable declaration costs only the field being validated", () => {
  const declared = {
    get value(): never {
      throw new Error("unreadable declaration");
    },
  };

  expect(validateDeclared(declared, "value", "anything")).toEqual({
    valid: false,
  });
});
