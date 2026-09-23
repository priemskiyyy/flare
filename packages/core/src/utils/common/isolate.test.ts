import { expect, test, vi } from "vitest";

import { isolate } from "src/utils/common/isolate";

const collectMicrotasks = () => {
  const tasks: Array<() => void> = [];

  vi.spyOn(globalThis, "queueMicrotask").mockImplementation((task) => {
    tasks.push(task);
  });

  return tasks;
};

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
