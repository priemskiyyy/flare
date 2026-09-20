import { expect, test } from "vitest";

import * as entry from "src/index";

test("the package exposes the provider, the composables and the boundary without runtime internals", () => {
  expect(Object.keys(entry).sort()).toEqual([
    "FlareErrorBoundary",
    "FlareProvider",
    "useDestinationStatus",
    "useFlare",
    "useFlareStatus",
  ]);
});
