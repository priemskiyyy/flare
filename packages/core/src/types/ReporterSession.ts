import type { AmbientReporterContext } from "src/types/AmbientReporterContext";
import type { FlushContext } from "src/types/FlushContext";
import type { FlushResult } from "src/types/FlushResult";
import type { SanitizedReport } from "src/types/SanitizedReport";
import type { SubmissionContext } from "src/types/SubmissionContext";
import type { SubmissionResult } from "src/types/SubmissionResult";

/**
 * One opened destination. `submit` receives frozen, sanitized data and must
 * keep everything event-local: it never mutates provider globals, not even
 * temporarily. The runtime calls `dispose` once and nothing after it.
 *
 * @example
 * ```ts
 * const session: ReporterSession<Beacon> = {
 *   native: beacon,
 *   submit: (report) => {
 *     beacon.send(JSON.stringify(report));
 *     return { status: "submitted", evidence: "sdk-call-returned" };
 *   },
 * };
 * ```
 */
export type ReporterSession<TNative = unknown> = {
  native: TNative;
  submit: (
    report: SanitizedReport,
    context: SubmissionContext,
  ) => SubmissionResult | Promise<SubmissionResult>;
  /** Waits for the provider's own queue. Omit it when the provider has none. */
  flush?: (context: FlushContext) => FlushResult | Promise<FlushResult>;
  ambient?: AmbientReporterContext;
  /** Takes back what `open` set up. Omit it when `open` set up nothing. */
  dispose?: () => void | Promise<void>;
};
