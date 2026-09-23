import { expect, test, vi } from "vitest";

import * as api from "src/index";
import * as mock from "src/mock";
import * as testing from "src/testing";

test("the package exposes the runtime, its errors and the default redaction, and no internals", () => {
  expect(Object.keys(api).sort()).toEqual([
    "Flare",
    "FlareError",
    "SanitizedError",
    "isSensitiveKey",
  ]);
});

test("the mock subpath exposes the mock adapter", () => {
  expect(Object.keys(mock)).toEqual(["createMockAdapter"]);
});

test("the testing subpath exposes the conformance suite", () => {
  expect(Object.keys(testing)).toEqual(["testReporterAdapter"]);
});

test("importing and constructing on a server is inert: no timer, no listener, nothing opened", async () => {
  vi.useFakeTimers();

  const addListener = vi.spyOn(process, "on");
  const { adapter, sessions } = mock.createMockAdapter();

  const fresh = await import("src/index");
  const flare = new fresh.Flare({ destinations: { primary: adapter } });

  expect(vi.getTimerCount()).toBe(0);
  expect(addListener).not.toHaveBeenCalled();
  expect(sessions).toEqual([]);
  expect(flare.status.get()).toEqual({ state: "idle" });
  vi.useRealTimers();
});
