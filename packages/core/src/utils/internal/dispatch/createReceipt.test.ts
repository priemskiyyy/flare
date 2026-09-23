import { expect, test, vi } from "vitest";

import type { DestinationOutcome } from "src/types/DestinationOutcome";
import { createReceipt } from "src/utils/internal/dispatch/createReceipt";

const submitted: DestinationOutcome = {
  status: "submitted",
  evidence: "sdk-call-returned",
  event: null,
  losses: [],
};

test("a receipt starts pending with every selected destination unanswered", () => {
  const { receipt } = createReceipt("report-1", ["sentry", "backend"]);

  expect(receipt.id).toBe("report-1");
  expect(receipt.status.get()).toEqual({
    state: "pending",
    outcomes: { sentry: null, backend: null },
  });
});

test("it settles once every destination has answered, not before", async () => {
  const { receipt, settle } = createReceipt("report-1", ["sentry", "backend"]);
  const settled = vi.fn();

  receipt.settled.then(settled);

  settle("sentry", submitted);
  await Promise.resolve();

  expect(settled).not.toHaveBeenCalled();
  expect(receipt.status.get()).toEqual({
    state: "pending",
    outcomes: { sentry: submitted, backend: null },
  });

  settle("backend", { status: "failed", error: "offline" });

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: {
      sentry: submitted,
      backend: { status: "failed", error: "offline" },
    },
  });
});

test("the first answer of a destination stands, a late one is ignored", async () => {
  const { receipt, settle } = createReceipt("report-1", ["sentry"]);

  settle("sentry", { status: "indeterminate", reason: "timeout" });
  settle("sentry", submitted);

  await expect(receipt.settled).resolves.toEqual({
    state: "settled",
    outcomes: { sentry: { status: "indeterminate", reason: "timeout" } },
  });
});

test("a late answer is ignored even while another destination is still pending", () => {
  const { receipt, settle } = createReceipt("report-1", ["sentry", "backend"]);

  settle("sentry", { status: "indeterminate", reason: "timeout" });
  settle("sentry", submitted);

  expect(receipt.status.get()).toEqual({
    state: "pending",
    outcomes: {
      sentry: { status: "indeterminate", reason: "timeout" },
      backend: null,
    },
  });
});

test("a dropped report settles at once with its reason", async () => {
  const { receipt, drop } = createReceipt("report-1", []);

  drop("stale-scope");

  await expect(receipt.settled).resolves.toEqual({
    state: "dropped",
    reason: "stale-scope",
  });
  expect(receipt.status.get()).toEqual({
    state: "dropped",
    reason: "stale-scope",
  });
});

test("observers are told as each answer arrives", () => {
  const { receipt, settle } = createReceipt("report-1", ["sentry", "backend"]);
  const listener = vi.fn();

  receipt.status.subscribe(listener);

  settle("sentry", submitted);
  settle("backend", submitted);

  expect(listener).toHaveBeenCalledTimes(2);
});

test("every status a receipt hands out is frozen", () => {
  const { receipt, settle } = createReceipt("report-1", ["sentry"]);
  const pending = receipt.status.get();

  settle("sentry", submitted);

  expect(Object.isFrozen(pending)).toBe(true);
  expect(Object.isFrozen(receipt.status.get())).toBe(true);
});
