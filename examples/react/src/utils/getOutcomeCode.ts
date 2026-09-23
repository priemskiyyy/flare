import type { DestinationOutcome } from "@priemskiyyy/flare";

import { assertUnreachable } from "src/utils/assertUnreachable";

/** The name Flare's API gives an outcome's evidence or reason, to look up in the docs. */
export const getOutcomeCode = (
  outcome: DestinationOutcome | null | undefined,
) => {
  if (outcome === undefined || outcome === null) {
    return null;
  }

  if (outcome.status === "submitted") {
    return outcome.evidence;
  }

  if (outcome.status === "failed") {
    return null;
  }

  if (
    outcome.status === "dropped" ||
    outcome.status === "skipped" ||
    outcome.status === "indeterminate"
  ) {
    return outcome.reason;
  }

  return assertUnreachable(outcome);
};
