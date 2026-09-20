import { expect, test } from "vitest";

import * as api from "src/index";
import * as react from "src/react";

test("each entry exposes the inspector and nothing else", () => {
  expect(Object.keys(api)).toEqual(["FlareDevtools"]);
  expect(Object.keys(react)).toEqual(["FlareDevtools"]);
});
