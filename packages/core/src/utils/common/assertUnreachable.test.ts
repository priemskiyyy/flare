import { expect, test } from "vitest";

import { assertUnreachable } from "src/utils/common/assertUnreachable";

type Level = "error" | "warning";

const describeLevel = (level: Level) => {
  if (level === "error") {
    return "an error";
  }

  if (level === "warning") {
    return "a warning";
  }

  return assertUnreachable(level);
};

test("a value that slipped past the types fails loudly and is named", () => {
  // Parsed data carries no static type, which is how an impossible variant arrives at runtime.
  const level: Level = JSON.parse('"verbose"');

  expect(() => describeLevel(level)).toThrow("Unexpected value: verbose");
});

test("every declared variant is handled before the unreachable branch", () => {
  expect(describeLevel("error")).toBe("an error");
  expect(describeLevel("warning")).toBe("a warning");
});
