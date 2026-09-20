import { expect, test } from "vitest";

import { formatEventTime } from "src/formatting/formatEventTime";

test("an event time is shown to the millisecond, in local time", () => {
  const time = new Date(2026, 8, 20, 9, 5, 7, 42).getTime();

  expect(formatEventTime(time)).toBe("09:05:07.042");
});
