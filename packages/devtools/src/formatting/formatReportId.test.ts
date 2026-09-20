import { expect, test } from "vitest";

import { formatReportId } from "src/formatting/formatReportId";

test("a report id is shortened for the row, and absent when the event has none", () => {
  expect(formatReportId("5f0c1c9e-6b1e-4a53-9d0e-2f6a1d0c7b11")).toBe(
    "5f0c1c9e",
  );
  expect(formatReportId("short")).toBe("short");
  expect(formatReportId(null)).toBe("");
});
