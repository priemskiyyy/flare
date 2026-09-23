import type { SanitizedReport } from "@priemskiyyy/flare";

import type { SentryEventLike } from "src/types/SentryEventLike";
import {
  AGGREGATED_CONTEXT,
  BREADCRUMB_CATEGORY,
  REPORT_ID_TAG,
} from "src/utils/constants/event";
import { getSentryBreadcrumb } from "src/utils/getSentryBreadcrumb";
import { getSentryUser } from "src/utils/getSentryUser";

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
    reportContexts[AGGREGATED_CONTEXT] = {
      errors: report.exception.aggregated.map(({ name, message }) => ({
        name,
        message,
      })),
    };
  }

  // Mirrored breadcrumbs describe submission time. Rebuild Flare's part
  // from capture time, including reports buffered before the mirror opened.
  const breadcrumbs = [
    ...(event.breadcrumbs ?? []).filter(
      (entry) => entry.category !== BREADCRUMB_CATEGORY,
    ),
    ...report.breadcrumbs.map(getSentryBreadcrumb),
  ].sort((first, second) => (first.timestamp ?? 0) - (second.timestamp ?? 0));

  const mapped: SentryEventLike = {
    ...event,
    user: getSentryUser(report.identity.user) ?? {},
    level: report.level,
    tags: { ...tags, ...report.tags, [REPORT_ID_TAG]: report.id },
    contexts: reportContexts,
    breadcrumbs,
  };

  if (report.operation !== null) {
    mapped.transaction = report.operation;
  }

  return mapped;
};
