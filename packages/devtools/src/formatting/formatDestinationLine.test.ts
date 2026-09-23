import { expect, test } from "vitest";

import { formatDestinationLine } from "src/formatting/formatDestinationLine";

test("a destination's line names its adapter and status, and its queues only when they hold something", () => {
  expect(
    formatDestinationLine({
      adapter: "sentry",
      status: { state: "ready" },
      buffered: 0,
      inFlight: 0,
    }),
  ).toBe("sentry · ready");
  expect(
    formatDestinationLine({
      adapter: "http",
      status: { state: "failed", error: new Error("init failed") },
      buffered: 2,
      inFlight: 1,
    }),
  ).toBe("http · failed · 2 buffered · 1 in flight");
});
