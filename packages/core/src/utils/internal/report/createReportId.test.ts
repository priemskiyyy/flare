import { afterEach, expect, test, vi } from "vitest";

import { createReportId } from "src/utils/internal/report/createReportId";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

test("an id is a version 4 UUID and no two are alike", () => {
  const ids = new Set(Array.from({ length: 200 }, createReportId));

  expect(ids.size).toBe(200);
  expect([...ids].every((id) => UUID.test(id))).toBe(true);
});

test("a runtime without crypto.randomUUID, such as Hermes, still gets valid ids", () => {
  vi.stubGlobal("crypto", undefined);

  const ids = new Set(Array.from({ length: 200 }, createReportId));

  expect(ids.size).toBe(200);
  expect([...ids].every((id) => UUID.test(id))).toBe(true);
});
