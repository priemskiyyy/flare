import { expect, test } from "vitest";

import * as api from "src/index";

test("the package exposes its bugsnag factory and nothing else", () => {
  expect(Object.keys(api)).toEqual(["bugsnag"]);
});
