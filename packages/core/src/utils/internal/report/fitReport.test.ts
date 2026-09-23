import { expect, test } from "vitest";

import type { SanitizedReport } from "src/types/SanitizedReport";
import { fitReport } from "src/utils/internal/report/fitReport";

const crumb = (name: string) => ({
  name,
  data: { pad: "x".repeat(100) },
  timestamp: 1,
});

const report = (
  overrides: Partial<Pick<SanitizedReport, "breadcrumbs" | "contexts">> = {},
): SanitizedReport => ({
  id: "report-1",
  timestamp: 1_000,
  level: "info",
  identity: { generation: 1, user: null },
  tags: {},
  contexts: {},
  breadcrumbs: [],
  operation: null,
  losses: [],
  kind: "message",
  message: "Unexpected payment state",
  ...overrides,
});

const sizeOf = (value: unknown) => JSON.stringify(value).length;

test("a report within the limit is returned untouched", () => {
  const original = report({ breadcrumbs: [crumb("opened")] });

  expect(fitReport(original, 10_000)).toBe(original);
});

test("an oversized report sheds its oldest breadcrumbs first", () => {
  const original = report({
    breadcrumbs: [crumb("first"), crumb("second"), crumb("third")],
    contexts: { upload: { attempt: 1 } },
  });

  // One breadcrumb serializes to roughly 150 characters, so shedding one is enough.
  const limit = sizeOf(original) - 100;

  const fitted = fitReport(original, limit);

  expect(fitted.breadcrumbs.map((entry) => entry.name)).toEqual([
    "second",
    "third",
  ]);
  expect(fitted.contexts).toEqual({ upload: { attempt: 1 } });
  expect(fitted.losses).toEqual([{ path: "breadcrumbs", reason: "truncated" }]);
  expect(sizeOf(fitted)).toBeLessThanOrEqual(limit + 60);
});

test("when breadcrumbs are not enough, contexts go next, last added first", () => {
  const original = report({
    breadcrumbs: [crumb("only")],
    contexts: {
      device: { model: "m".repeat(50) },
      upload: { note: "n".repeat(300) },
    },
  });

  const fitted = fitReport(original, sizeOf(original) - 400);

  expect(fitted.breadcrumbs).toEqual([]);
  expect(fitted.contexts).toEqual({ device: { model: "m".repeat(50) } });
  expect(fitted.losses).toEqual([
    { path: "breadcrumbs", reason: "truncated" },
    { path: "contexts.upload", reason: "truncated" },
  ]);
});

test("what the report is about is never shed, however small the limit", () => {
  const original = report({
    breadcrumbs: [crumb("only")],
    contexts: { a: { b: 1 } },
  });

  const fitted = fitReport(original, 1);

  expect(fitted).toMatchObject({
    kind: "message",
    message: "Unexpected payment state",
    breadcrumbs: [],
  });
  expect(fitted.contexts).toEqual({});
});

test("a fitted report is frozen like any other", () => {
  const fitted = fitReport(
    report({ breadcrumbs: [crumb("a"), crumb("b")] }),
    200,
  );

  expect(Object.isFrozen(fitted)).toBe(true);
  expect(Object.isFrozen(fitted.breadcrumbs)).toBe(true);
  expect(Object.isFrozen(fitted.contexts)).toBe(true);
  expect(Object.isFrozen(fitted.losses)).toBe(true);
});

test("losses added while fitting a report cannot be rewritten", () => {
  const fitted = fitReport(
    report({ contexts: { request: { attempt: 1 } } }),
    1,
  );

  for (const loss of fitted.losses) {
    Reflect.set(loss, "path", "changed");
  }

  expect(fitted.losses).toEqual([
    { path: "contexts.request", reason: "truncated" },
  ]);
});
