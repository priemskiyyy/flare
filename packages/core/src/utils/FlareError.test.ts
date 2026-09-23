import { expect, test } from "vitest";

import { FlareError } from "src/utils/FlareError";

test("an error Flare creates carries its code, and names itself", () => {
  const error = new FlareError({
    code: "NOT_INITIALIZED",
    message: "Sentry is not initialized.",
  });

  expect(error).toBeInstanceOf(Error);
  expect(error).toMatchObject({
    name: "FlareError",
    code: "NOT_INITIALIZED",
    message: "Sentry is not initialized.",
  });
});
