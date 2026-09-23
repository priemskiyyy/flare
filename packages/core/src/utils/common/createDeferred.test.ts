import { expect, test } from "vitest";
import { createDeferred } from "src/utils/common/createDeferred";

const macrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

test("resolves and rejects the promise from outside it", async () => {
  const resolved = createDeferred<number>();

  resolved.resolve(1);
  await expect(resolved.promise).resolves.toBe(1);

  const failure = new Error("hydration failed");
  const rejected = createDeferred();

  rejected.reject(failure);
  await expect(rejected.promise).rejects.toBe(failure);
});

test("a rejection nobody awaited raises no unhandled rejection", async () => {
  const unhandled: unknown[] = [];

  const handleUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };

  process.on("unhandledRejection", handleUnhandled);

  const { promise, reject } = createDeferred();

  reject(new Error("hydration failed"));
  await macrotask();
  process.off("unhandledRejection", handleUnhandled);

  expect(unhandled).toEqual([]);
  // The pre-attached catch swallows the report, not the rejection itself.
  await expect(promise).rejects.toThrow("hydration failed");
});
