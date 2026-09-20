import type { AmbientReporterContext } from "src/types/AmbientReporterContext";
import type { FlushContext } from "src/types/FlushContext";
import type { FlushResult } from "src/types/FlushResult";
import type { SanitizedReport } from "src/types/SanitizedReport";
import type { SubmissionContext } from "src/types/SubmissionContext";
import type { SubmissionResult } from "src/types/SubmissionResult";

/**
 * One opened destination. `submit` receives frozen, sanitized data and must
 * keep everything event-local: it never mutates provider globals, not even
 * temporarily. `flush` and `ambient` are absent when unsupported.
 */
export type ReporterSession<TNative = unknown> = {
  native: TNative;
  submit: (
    report: SanitizedReport,
    context: SubmissionContext,
  ) => SubmissionResult | Promise<SubmissionResult>;
  flush?: (context: FlushContext) => FlushResult | Promise<FlushResult>;
  ambient?: AmbientReporterContext;
  dispose: () => void | Promise<void>;
};
