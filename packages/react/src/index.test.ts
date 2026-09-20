import { expect, test } from "vitest";

import * as api from "src/index";

test("the package exposes the provider, the hooks and the boundary without runtime internals", () => {
  expect(Object.keys(api).sort()).toEqual([
    "FlareErrorBoundary",
    "FlareProvider",
    "useDestinationStatus",
    "useFlare",
    "useFlareStatus",
  ]);
});
