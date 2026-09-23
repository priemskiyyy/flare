import { expect, test } from "vitest";

import { devtoolsReducer, initialDevtoolsState } from "src/utils/devtoolsState";

test("the initial state opens only when asked and never moves focus on mount", () => {
  expect(initialDevtoolsState(false)).toEqual({
    panel: { status: "CLOSED", autoFocus: false, closedAt: 0 },
    isPaused: false,
  });
  expect(initialDevtoolsState(true)).toEqual({
    panel: { status: "OPEN", autoFocus: false },
    isPaused: false,
  });
});

test("opening and closing move focus and remember when the panel closed", () => {
  const opened = devtoolsReducer(initialDevtoolsState(false), { type: "OPEN" });

  expect(opened.panel).toEqual({ status: "OPEN", autoFocus: true });

  const closed = devtoolsReducer(opened, { type: "CLOSE", at: 42 });

  expect(closed.panel).toEqual({
    status: "CLOSED",
    autoFocus: true,
    closedAt: 42,
  });
});

test("pausing toggles and leaves the panel alone", () => {
  const paused = devtoolsReducer(initialDevtoolsState(true), {
    type: "TOGGLE_PAUSE",
  });

  expect(paused).toEqual({
    panel: { status: "OPEN", autoFocus: false },
    isPaused: true,
  });
  expect(devtoolsReducer(paused, { type: "TOGGLE_PAUSE" }).isPaused).toBe(
    false,
  );
});
