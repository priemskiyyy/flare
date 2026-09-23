import { afterEach, expect, test, vi } from "vitest";

import { createMockAdapter } from "src/mock/createMockAdapter";
import { Flare } from "src/utils/Flare";

afterEach(() => {
  vi.useRealTimers();
});

test("flush reports the core drain and how far each destination's own flush got", async () => {
  const flushing = createMockAdapter({ flush: true });
  const bare = createMockAdapter();

  const flare = new Flare({
    destinations: { flushing: flushing.adapter, bare: bare.adapter },
  });

  flare.start();
  flare.capture(new Error("boom"));

  await expect(flare.flush({ timeoutMs: 500 })).resolves.toEqual({
    drained: true,
    destinations: {
      flushing: { status: "flushed" },
      bare: { status: "unsupported" },
    },
  });
  expect(flushing.sessions[0]?.flushes[0]?.context.timeoutMs).toBe(500);
});

test("flush is a barrier: captures made after the call do not extend it", async () => {
  const mock = createMockAdapter({ hold: true, flush: true });
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();
  flare.capture(new Error("before"));

  const flushed = flare.flush({ timeoutMs: 1_000 });

  flare.capture(new Error("after"));
  mock.submissions[0]?.settle();

  await expect(flushed).resolves.toEqual({
    drained: true,
    destinations: { primary: { status: "flushed" } },
  });
  expect(flare.diagnostics.get().destinations[0]?.inFlight).toBe(1);
});

test("a flush that times out says so, and neither cancels nor disproves the submission", async () => {
  vi.useFakeTimers();

  const mock = createMockAdapter({ hold: true, flush: true });
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  const receipt = flare.capture(new Error("slow"));

  const flushed = flare.flush({ timeoutMs: 200 });

  await vi.advanceTimersByTimeAsync(200);

  await expect(flushed).resolves.toEqual({
    drained: false,
    destinations: { primary: { status: "timeout" } },
  });
  expect(receipt.status.get().state).toBe("pending");

  mock.submissions[0]?.settle();
  await vi.advanceTimersByTimeAsync(0);

  expect(receipt.status.get()).toMatchObject({
    state: "settled",
    outcomes: { primary: { status: "submitted" } },
  });
});

test("flush before start says not-ready rather than pretending", async () => {
  const mock = createMockAdapter({ flush: true });
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  await expect(flare.flush()).resolves.toEqual({
    drained: false,
    destinations: { primary: { status: "not-ready" } },
  });
});

test("a provider whose flush throws is a failed boundary, not a rejected promise", async () => {
  const failure = new Error("flush threw");
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: {
      primary: {
        ...mock.adapter,
        open: () => ({
          native: null,
          submit: () => ({
            status: "submitted",
            evidence: "sdk-call-returned",
            event: null,
            losses: [],
          }),
          flush: () => {
            throw failure;
          },
          dispose: () => {},
        }),
      },
    },
  });

  flare.start();

  await expect(flare.flush()).resolves.toEqual({
    drained: true,
    destinations: { primary: { status: "failed", error: failure } },
  });
});
