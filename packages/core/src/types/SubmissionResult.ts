import type { MappingLoss } from "src/types/MappingLoss";
import type { SubmissionEvidence } from "src/types/SubmissionEvidence";

/**
 * What an adapter answers for one report. Throwing or rejecting is read as
 * `failed`, and running past the deadline as `indeterminate`, so an adapter
 * only states what it actually knows.
 *
 * @example
 * ```ts
 * submit: (report) => {
 *   const id = sdk.captureMessage(text);
 *   return { status: "submitted", evidence: "sdk-call-returned", event: { id } };
 * };
 * ```
 */
export type SubmissionResult =
  | {
      status: "submitted";
      evidence: SubmissionEvidence;
      /** The provider's event reference. Defaults to `null` on the receipt. */
      event?: { id: string } | null;
      /** What this provider could not express. Defaults to an empty list on the receipt. */
      losses?: readonly MappingLoss[];
    }
  | { status: "dropped"; reason: "provider-filtered" }
  | {
      status: "skipped";
      /**
       * `auth-subject-mismatch`: the credentials at hand belong to another
       * account than the report. `identity-mismatch`: the provider can only
       * attribute a report to its current global user, and this report
       * belongs to someone else.
       */
      reason:
        | "unsupported-report-kind"
        | "auth-subject-mismatch"
        | "identity-mismatch";
    }
  | { status: "failed"; error: unknown }
  | { status: "indeterminate"; reason: "ambiguous" };
