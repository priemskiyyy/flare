import { afterEach, expect, test, vi } from "vitest";

import { createMockAdapter } from "src/mock/createMockAdapter";
import { Flare } from "src/utils/Flare";

afterEach(() => {
  vi.useRealTimers();
});

test("the same Error captured twice in quick succession is sent once, and again later", async () => {
  vi.useFakeTimers();

  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  const error = new Error("reused");

  flare.capture(error);

  const duplicate = flare.capture(error);

  vi.advanceTimersByTime(1_500);
  flare.capture(error);

  await expect(duplicate.settled).resolves.toEqual({
    state: "settled",
    outcomes: { primary: { status: "dropped", reason: "deduped" } },
  });
  expect(mock.submissions).toHaveLength(2);
});

test("equal messages are separate occurrences", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  flare.message("Unexpected payment state");
  flare.message("Unexpected payment state");

  expect(mock.submissions).toHaveLength(2);
});

test("an explicit dedupe key holds per destination and per identity", () => {
  const first = createMockAdapter();
  const second = createMockAdapter();

  const flare = new Flare({
    destinations: { first: first.adapter, second: second.adapter },
  });

  flare.start();
  flare.user({ id: "ada" });

  flare.capture(new Error("one"), {
    dedupe: { key: "checkout-failed" },
    to: ["first"],
  });
  flare.capture(new Error("two"), { dedupe: { key: "checkout-failed" } });
  flare.user({ id: "grace" });
  flare.capture(new Error("three"), { dedupe: { key: "checkout-failed" } });

  expect(
    first.submissions.map((submission) => submission.report.identity.user?.id),
  ).toEqual(["ada", "grace"]);
  expect(
    second.submissions.map((submission) => submission.report.identity.user?.id),
  ).toEqual(["ada", "grace"]);
});

test("a capture made from inside an adapter's submit is refused, so a feedback loop cannot start", async () => {
  const receipts: Array<
    ReturnType<
      Flare<{
        primary: ReturnType<typeof createMockAdapter>["adapter"];
      }>["capture"]
    >
  > = [];

  const mock = createMockAdapter({
    onSubmit: () => {
      receipts.push(flare.capture(new Error("logged while submitting")));
    },
  });

  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  flare.capture(new Error("original"));

  expect(mock.submissions).toHaveLength(1);
  await expect(receipts[0]?.settled).resolves.toEqual({
    state: "dropped",
    reason: "reentrant",
  });
});

test("a capture made after an adapter's submit has returned is an ordinary capture", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  flare.capture(new Error("first"));
  flare.capture(new Error("second"));

  expect(mock.submissions).toHaveLength(2);
});

test("an error storm is cut off per minute, announced once, and let through again afterwards", async () => {
  vi.useFakeTimers();

  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    limits: { reportsPerMinute: 3 },
  });

  flare.start();

  const announced = vi.fn();

  flare.diagnostics.events.subscribe((event) => {
    if (event.type === "rate limit reached") {
      announced();
    }
  });

  const receipts = Array.from({ length: 10 }, (_, index) =>
    flare.capture(new Error(`storm ${index}`)),
  );

  expect(mock.submissions).toHaveLength(3);
  await expect(receipts[9]?.settled).resolves.toEqual({
    state: "dropped",
    reason: "rate-limited",
  });
  expect(announced).toHaveBeenCalledTimes(1);

  vi.advanceTimersByTime(60_000);
  flare.capture(new Error("after the storm"));

  expect(mock.submissions).toHaveLength(4);
});
