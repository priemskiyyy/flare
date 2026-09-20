import { expect, test } from "vitest";

import * as browser from "src/index";
import * as reactNative from "src/reactNative";

test("each entry exposes its bugsnag factory and nothing else", () => {
  expect(Object.keys(browser)).toEqual(["bugsnag"]);
  expect(Object.keys(reactNative)).toEqual(["bugsnag"]);
  expect(browser.bugsnag).not.toBe(reactNative.bugsnag);
});
