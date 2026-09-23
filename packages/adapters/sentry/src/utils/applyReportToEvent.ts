import type { SanitizedReport } from "@priemskiyyy/flare";

import type { SentryEventLike } from "src/types/SentryEventLike";
import { toSentryBreadcrumb } from "src/utils/toSentryBreadcrumb";
import { toSentryUser } from "src/utils/toSentryUser";

/**
 * Applies the snapshot after Sentry combines its scopes. Setting fields on
 * the fork alone would still merge in the current account's isolation scope.
 */
export const applyReportToEvent = (
  event: SentryEventLike,
  report: SanitizedReport,
  mirrored: { tags: string[]; contexts: string[] },
): SentryEventLike => {
  const tags = { ...event.tags };
  const contexts = { ...event.contexts };

  for (const key of mirrored.tags) {
    delete tags[key];
  }

  for (const name of mirrored.contexts) {
    delete contexts[name];
  }

  const reportContexts = { ...contexts, ...report.contexts };

  if (report.kind === "exception" && report.exception.aggregated.length > 0) {
    // Sentry has no field for the errors of an AggregateError.
    reportContexts["flare.aggregated"] = {
      errors: report.exception.aggregated.map(({ name, message }) => ({
        name,
        message,
      })),
    };
  }

  // Mirrored breadcrumbs describe submission time. Rebuild Flare's part
  // from capture time, including reports buffered before the mirror opened.
  const breadcrumbs = [
    ...(event.breadcrumbs ?? []).filter((entry) => entry.category !== "flare"),
    ...report.breadcrumbs.map(toSentryBreadcrumb),
  ].sort((first, second) => (first.timestamp ?? 0) - (second.timestamp ?? 0));

  return {
    ...event,
    user: toSentryUser(report.identity.user) ?? {},
    level: report.level,
    tags: { ...tags, ...report.tags, "flare.report_id": report.id },
    contexts: reportContexts,
    breadcrumbs,
    ...(report.operation === null ? {} : { transaction: report.operation }),
  };
};
