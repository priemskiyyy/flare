import type { SanitizedReport } from "@priemskiyyy/flare";
import { expect, test } from "vitest";

import { formatReportLine } from "src/formatting/formatReportLine";

const base = {
  id: "0b0e7a52-9c1d-4f6e-8a3b-1c2d3e4f5a6b",
  timestamp: 1,
  level: "error" as const,
  identity: { generation: 1, user: null },
  tags: {},
  contexts: {},
  breadcrumbs: [],
  operation: null,
  losses: [],
};

const exception = (
  overrides: { operation?: string | null; message?: string } = {},
): SanitizedReport => ({
  ...base,
  operation: overrides.operation ?? null,
  kind: "exception",
  exception: {
    origin: "error",
    name: "UploadError",
    message: overrides.message ?? "upload failed",
    stack: null,
    causes: [],
    aggregated: [],
  },
});

test("an exception is summarized by level, name and message", () => {
  expect(formatReportLine(exception())).toBe(
    "[flare] error UploadError: upload failed",
  );
});

test("a message is summarized by level and text", () => {
  expect(
    formatReportLine({
      ...base,
      level: "warning",
      kind: "message",
      message: "Unexpected payment state",
    }),
  ).toBe("[flare] warning Unexpected payment state");
});

test("the active operation is named when there is one", () => {
  expect(formatReportLine(exception({ operation: "upload-avatar" }))).toBe(
    "[flare] error UploadError: upload failed (upload-avatar)",
  );
});

test("an exception without a message is summarized by its name alone", () => {
  expect(formatReportLine(exception({ message: "" }))).toBe(
    "[flare] error UploadError",
  );
});
