import type { DestinationOutcome } from "src/types/DestinationOutcome";
import { assertUnreachable } from "src/utils/common/assertUnreachable";

/**
 * The shape of an outcome, for a diagnostic event. It never carries the error
 * a provider failed with or the losses themselves: either could echo content.
 */
export const describeOutcome = (outcome: DestinationOutcome) => {
  if (outcome.status === "submitted") {
    return {
      status: outcome.status,
      reason: null,
      losses: outcome.losses.length,
    };
  }

  if (outcome.status === "failed") {
    return { status: outcome.status, reason: null, losses: 0 };
  }

  if (
    outcome.status === "dropped" ||
    outcome.status === "skipped" ||
    outcome.status === "indeterminate"
  ) {
    return { status: outcome.status, reason: outcome.reason, losses: 0 };
  }

  return assertUnreachable(outcome);
};
