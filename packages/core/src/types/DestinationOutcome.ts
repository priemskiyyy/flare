import type { MappingLoss } from "src/types/MappingLoss";
import type { SubmissionEvidence } from "src/types/SubmissionEvidence";

/**
 * What happened to one report at one destination.
 *
 * - `submitted`: the adapter reached the boundary named by `evidence`.
 *   Nothing beyond that boundary is claimed.
 * - `dropped`: the report was accepted for this destination and then
 *   discarded before that boundary, by Flare or by a provider hook that gave
 *   a definite answer.
 * - `skipped`: Flare never attempted this destination.
 * - `failed`: an attempt was made and definitely failed.
 * - `indeterminate`: an attempt was made and its outcome cannot be known. A
 *   deadline is this, never `failed`: the report may still have been sent.
 *   So is disposal while a submission is in flight.
 *
 * @example
 * ```ts
 * const status = await flare.capture(error).settled;
 * if (status.state === "settled" && status.outcomes.sentry?.status === "failed") {
 *   showOfflineBanner();
 * }
 * ```
 */
export type DestinationOutcome =
  | {
      readonly status: "submitted";
      readonly evidence: SubmissionEvidence;
      readonly event: { readonly id: string } | null;
      readonly losses: readonly MappingLoss[];
    }
  | {
      readonly status: "dropped";
      readonly reason:
        | "buffer-overflow"
        | "buffer-expired"
        | "deduped"
        | "disposed"
        | "provider-filtered";
    }
  | {
      readonly status: "skipped";
      readonly reason:
        | "start-failed"
        | "unsupported-report-kind"
        | "auth-subject-mismatch"
        | "identity-mismatch";
    }
  | { readonly status: "failed"; readonly error: unknown }
  | {
      readonly status: "indeterminate";
      readonly reason: "deadline" | "ambiguous" | "disposed";
    };
