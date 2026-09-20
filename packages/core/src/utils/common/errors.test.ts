import { expect, test, vi } from "vitest";

import { captureError, combineErrors, isolate } from "src/utils/common/errors";

const collectMicrotasks = () => {
  const tasks: Array<() => void> = [];
  vi.spyOn(globalThis, "queueMicrotask").mockImplementation((task) => {
    tasks.push(task);
  });
  return tasks;
};

test("captureError returns nothing for work that succeeds", () => {
  expect(captureError(() => {})).toEqual([]);
});

test("captureError returns the thrown value instead of throwing", () => {
  const failure = new Error("cleanup failed");

  expect(
    captureError(() => {
      throw failure;
    }),
  ).toEqual([failure]);
});

test("a single failure is rethrown as itself, not wrapped", () => {
  const failure = new Error("only");

  expect(combineErrors([failure], "Flare cleanup failed.")).toBe(failure);
});

test("several failures are combined under the given message", () => {
  const first = new Error("first");
  const second = new Error("second");

  const combined = combineErrors([first, second], "Flare cleanup failed.");

  expect(combined).toBeInstanceOf(AggregateError);
  expect(combined).toMatchObject({
    message: "Flare cleanup failed.",
    errors: [first, second],
  });
});

test("a throwing callback cannot break its caller and is rethrown outside the chain", () => {
  const tasks = collectMicrotasks();
  const failure = new Error("listener failed");

  expect(() =>
    isolate(() => {
      throw failure;
    }),
  ).not.toThrow();

  expect(tasks).toHaveLength(1);
  expect(tasks[0]).toThrow(failure);
});

test("a callback whose promise rejects is reported the same way", async () => {
  const tasks = collectMicrotasks();
  const failure = new Error("async listener failed");

  isolate(() => Promise.reject(failure));
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(tasks).toHaveLength(1);
  expect(tasks[0]).toThrow(failure);
});

test("a callback that returns nothing schedules nothing", () => {
  const tasks = collectMicrotasks();

  isolate(() => {});

  expect(tasks).toEqual([]);
});
