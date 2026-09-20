import { expect, test } from "vitest";

import * as browser from "src/index";
import * as reactNative from "src/reactNative";

test("each entry exposes its sentry factory and nothing else", () => {
  expect(Object.keys(browser)).toEqual(["sentry"]);
  expect(Object.keys(reactNative)).toEqual(["sentry"]);
  expect(browser.sentry).not.toBe(reactNative.sentry);
});
