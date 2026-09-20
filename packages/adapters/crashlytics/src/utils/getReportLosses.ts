import type { MappingLoss, SanitizedReport } from "@priemskiyyy/flare";

/**
 * Everything a report carries that `recordError` has no argument for. It is
 * listed even when the ambient integration is on: what Crashlytics attaches
 * then is its global state, not this report's.
 */
export const getReportLosses = (report: SanitizedReport): MappingLoss[] => {
  const losses: MappingLoss[] = [];
  if (report.identity.user !== null) {
    losses.push({ path: "identity.user", reason: "unsupported" });
  }
  if (Object.keys(report.tags).length > 0) {
    losses.push({ path: "tags", reason: "unsupported" });
  }
  if (Object.keys(report.contexts).length > 0) {
    losses.push({ path: "contexts", reason: "unsupported" });
  }
  if (report.breadcrumbs.length > 0) {
    losses.push({ path: "breadcrumbs", reason: "unsupported" });
  }
  if (report.operation !== null) {
    losses.push({ path: "operation", reason: "unsupported" });
  }
  // Whatever is recorded is a non-fatal. There is no other level.
  if (report.level !== "error") {
    losses.push({ path: "level", reason: "unsupported" });
  }
  if (report.kind === "exception" && report.exception.aggregated.length > 0) {
    losses.push({ path: "exception.aggregated", reason: "unsupported" });
  }
  return losses;
};
