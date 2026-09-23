import { afterEach, expect, test, vi } from "vitest";

import { createMockAdapter } from "src/mock/createMockAdapter";
import type { FlareOptions } from "src/types/FlareOptions";
import { Flare } from "src/utils/Flare";

afterEach(() => {
  vi.useRealTimers();
});

test("a nested option left undefined keeps its default", () => {
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    // @ts-expect-error -- a JavaScript caller can pass undefined.
    privacy: { limits: { breadcrumbs: undefined } },
  });

  flare.start();

  for (let step = 0; step < 60; step += 1) {
    flare.breadcrumb(`step ${step}`);
  }

  flare.capture(new Error("boom"));

  expect(mock.submissions[0]?.report.breadcrumbs).toHaveLength(50);
});

test("an undefined buffer age keeps the default, so a report captured before start is delivered", async () => {
  vi.useFakeTimers();

  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    // @ts-expect-error -- a JavaScript caller can pass undefined.
    buffer: { maxAge: undefined },
  });

  const receipt = flare.capture(new Error("before start"));

  await vi.advanceTimersByTimeAsync(10);
  flare.start();

  await expect(receipt.settled).resolves.toMatchObject({
    outcomes: { primary: { status: "submitted" } },
  });
});

const INVALID_OPTIONS: Array<{
  name: string;
  options: Pick<
    FlareOptions,
    "timeout" | "buffer" | "dedupe" | "rateLimits" | "privacy"
  >;
}> = [
  { name: "timeout", options: { timeout: Number.NaN } },
  { name: "timeout", options: { timeout: -1 } },
  { name: "timeout", options: { timeout: Number.POSITIVE_INFINITY } },
  { name: "buffer.maxAge", options: { buffer: { maxAge: 2 ** 31 } } },
  { name: "buffer.capacity", options: { buffer: { capacity: 1.5 } } },
  { name: "dedupe.window", options: { dedupe: { window: -5 } } },
  {
    name: "rateLimits.perMinute",
    options: { rateLimits: { perMinute: -1 } },
  },
  {
    name: "privacy.limits.depth",
    options: { privacy: { limits: { depth: Number.NaN } } },
  },
];

test.each(INVALID_OPTIONS)(
  "$name is refused when it is not a usable number",
  ({ name, options }) => {
    expect(
      () =>
        new Flare({
          ...options,
          destinations: { primary: createMockAdapter().adapter },
        }),
    ).toThrow(
      expect.objectContaining({
        name: "FlareError",
        code: "INVALID_CONFIGURATION",
        message: expect.stringContaining(name),
      }),
    );
  },
);

test("an infinite flush timeout waits for the destination instead of giving up at once", async () => {
  const mock = createMockAdapter({ hold: true });
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();
  flare.capture(new Error("in flight"));

  const flushing = flare.flush({ timeout: Number.POSITIVE_INFINITY });

  await new Promise((resolve) => setTimeout(resolve, 20));
  mock.submissions[0]?.settle();

  await expect(flushing).resolves.toMatchObject({ drained: true });
});

test("a pending flush keeps the process alive, because its caller is waiting for it", () => {
  const mock = createMockAdapter({ hold: true });
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();
  flare.capture(new Error("in flight"));

  const countTimers = () =>
    process
      .getActiveResourcesInfo()
      .filter((resource) => resource === "Timeout").length;

  const before = countTimers();

  flare.flush({ timeout: 10_000 }).catch(() => {});

  expect(countTimers()).toBe(before + 1);
  mock.submissions[0]?.settle();
});
