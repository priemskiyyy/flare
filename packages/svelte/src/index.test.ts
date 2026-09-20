import { expect, test } from "vitest";

import * as entry from "./index.js";

test("the package exposes the provider, the utilities and the boundary without runtime internals", () => {
  expect(Object.keys(entry).sort()).toEqual([
    "FlareErrorBoundary",
    "FlareProvider",
    "useDestinationStatus",
    "useFlare",
    "useFlareStatus",
  ]);
});
