import { expect, test } from "vitest";

import type { MappingLoss } from "src/types/MappingLoss";
import type { SubmissionResult } from "src/types/SubmissionResult";
import { copySubmissionOutcome } from "src/utils/internal/destinations/copySubmissionOutcome";

test("a submitted result without an event or losses publishes null and an empty list", () => {
  expect(
    copySubmissionOutcome({
      status: "submitted",
      evidence: "sdk-call-returned",
    }),
  ).toEqual({
    status: "submitted",
    evidence: "sdk-call-returned",
    event: null,
    losses: [],
  });
});

test("the event and the losses are copied, so the adapter cannot change a published outcome", () => {
  const event = { id: "event-1" };

  const losses: MappingLoss[] = [
    { path: "breadcrumbs", reason: "unsupported" },
  ];

  const outcome = copySubmissionOutcome({
    status: "submitted",
    evidence: "backend-acknowledged",
    event,
    losses,
  });

  event.id = "changed by the provider";
  losses.push({ path: "tags", reason: "unsupported" });

  expect(outcome).toEqual({
    status: "submitted",
    evidence: "backend-acknowledged",
    event: { id: "event-1" },
    losses: [{ path: "breadcrumbs", reason: "unsupported" }],
  });
});

test("a published event and its losses cannot be rewritten by a consumer", () => {
  const outcome = copySubmissionOutcome({
    status: "submitted",
    evidence: "sdk-call-returned",
    event: { id: "event-1" },
    losses: [{ path: "breadcrumbs", reason: "unsupported" }],
  });

  if (outcome.status !== "submitted" || outcome.event === null) {
    throw new Error("Expected a submitted event.");
  }

  Reflect.set(outcome.event, "id", "changed");

  for (const loss of outcome.losses) {
    Reflect.set(loss, "path", "changed");
  }

  expect(outcome.event).toEqual({ id: "event-1" });
  expect(outcome.losses).toEqual([
    { path: "breadcrumbs", reason: "unsupported" },
  ]);
});

test("any other answer is published as a copy of itself", () => {
  const result: SubmissionResult = {
    status: "skipped",
    reason: "identity-mismatch",
  };

  const outcome = copySubmissionOutcome(result);

  expect(outcome).toEqual(result);
  expect(outcome).not.toBe(result);
});
