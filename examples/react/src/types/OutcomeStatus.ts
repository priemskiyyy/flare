import type { DestinationOutcome } from "@priemskiyyy/flare";

/**
 * A destination's part in one report, as the page shows it: Flare's outcome,
 * `pending` until the destination answers, or `not-routed` when routing
 * left it out.
 */
export type OutcomeStatus =
  DestinationOutcome["status"] | "pending" | "not-routed";
