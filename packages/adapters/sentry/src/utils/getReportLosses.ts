import type { MappingLoss, SanitizedReport } from "@priemskiyyy/flare";

const MAX_KEY_LENGTH = 32;
const MAX_VALUE_LENGTH = 200;

/** Fields replaced by Flare's mapping or cut by Sentry's tag limits. */
export const getReportLosses = (report: SanitizedReport): MappingLoss[] => {
  const losses: MappingLoss[] = [];
  for (const [key, value] of Object.entries(report.tags)) {
    if (key === "flare.report_id") {
      losses.push({ path: `tags.${key}`, reason: "unsupported" });
      continue;
    }
    if (
      key.length > MAX_KEY_LENGTH ||
      String(value).length > MAX_VALUE_LENGTH
    ) {
      losses.push({ path: `tags.${key}`, reason: "truncated" });
    }
  }
  if (
    report.kind === "exception" &&
    report.exception.aggregated.length > 0 &&
    Object.hasOwn(report.contexts, "flare.aggregated")
  ) {
    losses.push({ path: "contexts.flare.aggregated", reason: "unsupported" });
  }
  return losses;
};
