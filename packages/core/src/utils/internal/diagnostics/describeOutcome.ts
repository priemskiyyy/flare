import type { DestinationOutcome } from "src/types/DestinationOutcome";

/**
 * The shape of an outcome, for a diagnostic event. It never carries the error
 * a provider failed with or the losses themselves: either could echo content.
 */
export const describeOutcome = (outcome: DestinationOutcome) => ({
  status: outcome.status,
  reason: "reason" in outcome ? outcome.reason : null,
  losses: outcome.status === "submitted" ? outcome.losses.length : 0,
});
