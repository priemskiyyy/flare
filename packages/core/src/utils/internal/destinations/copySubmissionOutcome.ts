import type { DestinationOutcome } from "src/types/DestinationOutcome";
import type { MappingLoss } from "src/types/MappingLoss";
import type { SubmissionResult } from "src/types/SubmissionResult";
import { FlareError } from "src/utils/FlareError";

const NO_LOSSES: readonly MappingLoss[] = Object.freeze([]);

const copyEvent = (event: { id: string } | null | undefined) => {
  if (event === undefined || event === null) {
    return null;
  }

  return Object.freeze({ id: event.id });
};

const copyLosses = (losses: readonly MappingLoss[] | undefined) => {
  if (losses === undefined) {
    return NO_LOSSES;
  }

  return Object.freeze(
    losses.map(({ path, reason }) => Object.freeze({ path, reason })),
  );
};

const INVALID_ANSWER = () =>
  new FlareError({
    code: "INVALID_ANSWER",
    message: "The adapter answered submit with no status its contract allows.",
  });

/**
 * The outcome a receipt publishes for an adapter's answer: the fields its
 * status allows, copied, so a published receipt cannot change afterwards.
 * An answer the contract does not allow throws, and the caller fails the
 * submission with it.
 */
export const copySubmissionOutcome = (
  result: SubmissionResult,
): DestinationOutcome => {
  // A JavaScript adapter can answer anything.
  if (typeof result !== "object" || result === null) {
    throw INVALID_ANSWER();
  }

  if (result.status === "submitted") {
    const { evidence, event, losses } = result;

    return {
      status: "submitted",
      evidence,
      event: copyEvent(event),
      losses: copyLosses(losses),
    };
  }

  if (result.status === "dropped") {
    return { status: "dropped", reason: result.reason };
  }

  if (result.status === "skipped") {
    return { status: "skipped", reason: result.reason };
  }

  if (result.status === "failed") {
    return { status: "failed", error: result.error };
  }

  if (result.status === "indeterminate") {
    return { status: "indeterminate", reason: result.reason };
  }

  throw INVALID_ANSWER();
};
