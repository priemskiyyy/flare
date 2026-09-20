import { expect, test } from "vitest";

import * as api from "src/index";

test("the package exposes the console reporter and nothing else", () => {
  expect(Object.keys(api)).toEqual(["consoleReporter"]);
});
