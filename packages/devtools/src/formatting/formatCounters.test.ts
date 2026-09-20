import { expect, test } from "vitest";

import { formatCounters } from "src/formatting/formatCounters";

test("the header counts the identity, the breadcrumbs and the pending receipts", () => {
  expect(
    formatCounters({ generation: 1, breadcrumbs: 1, pendingReceipts: 1 }),
  ).toBe("identity #1 · 1 breadcrumb · 1 pending");
  expect(
    formatCounters({ generation: 4, breadcrumbs: 0, pendingReceipts: 12 }),
  ).toBe("identity #4 · 0 breadcrumbs · 12 pending");
});
