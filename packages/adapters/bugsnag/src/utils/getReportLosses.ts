import type { MappingLoss, SanitizedReport } from "@priemskiyyy/flare";

import { RESERVED_SECTIONS } from "src/utils/constants/metadata";

/** What Bugsnag cannot express for this report, given how the reporter was configured. */
export const getReportLosses = (
  report: SanitizedReport,
  { carriesBreadcrumbs }: { carriesBreadcrumbs: boolean },
): MappingLoss[] => {
  const losses: MappingLoss[] = [];

  if (report.kind === "message") {
    losses.push({ path: "kind", reason: "unsupported" });
  }

  if (report.level === "fatal") {
    losses.push({ path: "level", reason: "unsupported" });
  }

  if (!carriesBreadcrumbs && report.breadcrumbs.length > 0) {
    losses.push({ path: "breadcrumbs", reason: "unsupported" });
  }

  for (const name of RESERVED_SECTIONS) {
    if (Object.hasOwn(report.contexts, name)) {
      losses.push({ path: `contexts.${name}`, reason: "unsupported" });
    }
  }

  return losses;
};
