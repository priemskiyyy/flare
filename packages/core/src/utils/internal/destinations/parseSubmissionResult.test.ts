import { expect, test, vi } from "vitest";

import { parseSubmissionResult } from "src/utils/internal/destinations/parseSubmissionResult";

test.each([
  {
    status: "submitted",
    evidence: "backend-acknowledged",
    event: { id: "evt_1" },
    losses: [{ path: "breadcrumbs", reason: "unsupported" }],
  },
  {
    status: "submitted",
    evidence: "sdk-call-returned",
    event: null,
    losses: [],
  },
  { status: "dropped", reason: "provider-filtered" },
  { status: "skipped", reason: "unsupported-report-kind" },
  { status: "skipped", reason: "auth-subject-mismatch" },
  { status: "skipped", reason: "identity-mismatch" },
  { status: "failed", error: "offline" },
  { status: "indeterminate", reason: "ambiguous" },
])("a well formed $status result is kept as it is", (result) => {
  expect(parseSubmissionResult(result)).toEqual(result);
});

test.each([
  { label: "nothing", result: undefined },
  { label: "a string", result: "submitted" },
  { label: "an unknown status", result: { status: "delivered" } },
  {
    label: "unknown evidence",
    result: {
      status: "submitted",
      evidence: "stored",
      event: null,
      losses: [],
    },
  },
  {
    label: "a reason only the core may give",
    result: { status: "dropped", reason: "deduped" },
  },
  {
    label: "a skip reason only the core may give",
    result: { status: "skipped", reason: "unavailable" },
  },
  {
    label: "a deadline it cannot know about",
    result: { status: "indeterminate", reason: "deadline" },
  },
])("$label is not a result", (row) => {
  expect(parseSubmissionResult(row.result)).toBeNull();
});

test("a submitted result is repaired rather than refused over its optional parts", () => {
  expect(
    parseSubmissionResult({
      status: "submitted",
      evidence: "sdk-call-returned",
      event: { id: 42 },
      losses: [{ path: "tags", reason: "unsupported" }, "garbage", { path: 1 }],
    }),
  ).toEqual({
    status: "submitted",
    evidence: "sdk-call-returned",
    event: null,
    losses: [{ path: "tags", reason: "unsupported" }],
  });
});

test("a submitted result keeps the evidence and event id it actually read", () => {
  const evidence = vi
    .fn()
    .mockReturnValueOnce("backend-acknowledged")
    .mockReturnValue("invalid");
  const id = vi.fn().mockReturnValueOnce("event-1").mockReturnValue(42);
  const event = vi
    .fn()
    .mockReturnValueOnce(Object.defineProperty({}, "id", { get: id }))
    .mockReturnValue(null);
  const result = Object.defineProperties(
    { status: "submitted" },
    { evidence: { get: evidence }, event: { get: event } },
  );

  expect(parseSubmissionResult(result)).toEqual({
    status: "submitted",
    evidence: "backend-acknowledged",
    event: { id: "event-1" },
    losses: [],
  });
  expect(evidence).toHaveBeenCalledTimes(1);
  expect(event).toHaveBeenCalledTimes(1);
  expect(id).toHaveBeenCalledTimes(1);
});

test.each([
  { status: "submitted", evidence: "sdk-call-returned" },
  { status: "failed", error: "offline" },
])("a $status result does not read an unrelated reason", (result) => {
  const withReason = Object.defineProperty({ ...result }, "reason", {
    get: () => {
      throw new Error("This result has no reason.");
    },
  });

  expect(parseSubmissionResult(withReason)).toMatchObject(result);
});

test("parsed mapping losses cannot be rewritten", () => {
  const result = parseSubmissionResult({
    status: "submitted",
    evidence: "sdk-call-returned",
    losses: [{ path: "breadcrumbs", reason: "unsupported" }],
  });
  if (result?.status !== "submitted") {
    throw new Error("Expected a submitted result.");
  }
  for (const loss of result.losses) {
    Reflect.set(loss, "path", "changed");
  }
  Reflect.set(result.losses, "length", 0);

  expect(result.losses).toEqual([
    { path: "breadcrumbs", reason: "unsupported" },
  ]);
});

test.each([undefined, null, "event-1", {}, { id: 42 }])(
  "an unusable provider event %j is omitted",
  (event) => {
    const result = parseSubmissionResult({
      status: "submitted",
      evidence: "backend-acknowledged",
      event,
    });

    expect(result).toMatchObject({ status: "submitted", event: null });
  },
);

test("a receipt owns an immutable event reference without unrelated provider data", () => {
  const event = { id: "event-1", token: "provider-secret" };
  const result = parseSubmissionResult({
    status: "submitted",
    evidence: "backend-acknowledged",
    event,
  });
  if (result?.status !== "submitted" || result.event === null) {
    throw new Error("Expected a submitted event.");
  }

  event.id = "changed by provider";
  Reflect.set(result.event, "id", "changed by consumer");

  expect(result.event).toEqual({ id: "event-1" });
  expect(Object.isFrozen(event)).toBe(false);
});
