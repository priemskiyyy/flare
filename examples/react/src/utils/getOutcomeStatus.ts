import type { DestinationOutcome } from "@priemskiyyy/flare";

import type { OutcomeStatus } from "src/types/OutcomeStatus";

/** A receipt leaves out a destination that routing skipped, and holds `null` for one in flight. */
export const getOutcomeStatus = (
  outcome: DestinationOutcome | null | undefined,
): OutcomeStatus => {
  if (outcome === undefined) {
    return "not-routed";
  }

  if (outcome === null) {
    return "pending";
  }

  return outcome.status;
};
