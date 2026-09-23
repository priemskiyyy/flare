import { expect, test } from "vitest";

import { RateWindow } from "src/utils/internal/dispatch/RateWindow";

test("reports within the limit are admitted and the next one is refused", () => {
  const window = new RateWindow({ perMinute: 2 });

  expect(window.admit(0)).toBe("admitted");
  expect(window.admit(10)).toBe("admitted");
  expect(window.admit(20)).toBe("refused-first");
});

test("a new minute admits again", () => {
  const window = new RateWindow({ perMinute: 1 });

  expect(window.admit(0)).toBe("admitted");
  expect(window.admit(59_999)).toBe("refused-first");
  expect(window.admit(60_000)).toBe("admitted");
});

test("only the first refusal of a window is marked, so a storm is announced once", () => {
  const window = new RateWindow({ perMinute: 1 });

  window.admit(0);

  expect(window.admit(1)).toBe("refused-first");
  expect(window.admit(2)).toBe("refused");
  expect(window.admit(60_001)).toBe("admitted");
  expect(window.admit(60_002)).toBe("refused-first");
});
