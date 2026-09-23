import type { FlareLevel, SanitizedReport } from "@priemskiyyy/flare";

import type { BugsnagBreadcrumbConstructorLike } from "src/types/BugsnagBreadcrumbConstructorLike";
import type { BugsnagEventLike } from "src/types/BugsnagEventLike";
import { assertUnreachable } from "src/utils/assertUnreachable";
import {
  BREADCRUMB_TYPE,
  GENERATION_KEY,
} from "src/utils/constants/breadcrumbs";
import {
  AGGREGATED_SECTION,
  FLARE_SECTION,
  RESERVED_SECTIONS,
  TAGS_SECTION,
} from "src/utils/constants/metadata";

type Options = {
  Breadcrumb: BugsnagBreadcrumbConstructorLike;
  /** Sections the ambient mirror wrote to the client, which every event starts with a copy of. */
  mirroredSections: string[];
};

// Bugsnag has three severities, so fatal is recorded as an error.
const getBugsnagSeverity = (
  level: FlareLevel,
): BugsnagEventLike["severity"] => {
  if (level === "fatal" || level === "error") {
    return "error";
  }

  if (level === "warning") {
    return "warning";
  }

  if (level === "info") {
    return "info";
  }

  return assertUnreachable(level);
};

// `addMetadata` merges into a section, and a Flare context replaces by name.
const replaceMetadataSection = (
  event: BugsnagEventLike,
  section: string,
  values: Record<string, unknown>,
) => {
  event.clearMetadata(section);
  event.addMetadata(section, { ...values });
};

/**
 * Writes one report onto the event of one `notify` call. The user is always
 * written, cleared included: an anonymous report must not inherit whoever the
 * client still names.
 */
export const applyReportToEvent = (
  event: BugsnagEventLike,
  report: SanitizedReport,
  { Breadcrumb, mirroredSections }: Options,
) => {
  // The mirror describes the current account, which may not be the one the
  // report was captured under.
  for (const section of mirroredSections) {
    event.clearMetadata(section);
  }

  const { user } = report.identity;

  event.setUser(user?.id, user?.email, user?.name);
  event.severity = getBugsnagSeverity(report.level);

  if (report.operation !== null) {
    event.context = report.operation;
  }

  event.clearMetadata(TAGS_SECTION);

  if (Object.keys(report.tags).length > 0) {
    event.addMetadata(TAGS_SECTION, { ...report.tags });
  }

  for (const [name, context] of Object.entries(report.contexts)) {
    if (RESERVED_SECTIONS.includes(name)) {
      continue;
    }

    replaceMetadataSection(event, name, context);
  }

  replaceMetadataSection(event, FLARE_SECTION, {
    report_id: report.id,
    level: report.level,
  });

  if (report.kind === "exception" && report.exception.aggregated.length > 0) {
    replaceMetadataSection(event, AGGREGATED_SECTION, {
      errors: report.exception.aggregated.map(({ name, message }) => ({
        name,
        message,
      })),
    });
  }

  // The client's breadcrumbs are from submission time and may belong to
  // another account, so Flare's part is replaced by the report's own.
  const kept = event.breadcrumbs.filter(
    (breadcrumb) => breadcrumb.metadata[GENERATION_KEY] === undefined,
  );

  const own = report.breadcrumbs.map((entry) => {
    const breadcrumb = new Breadcrumb();

    breadcrumb.message = entry.name;
    breadcrumb.metadata = { ...entry.data };
    breadcrumb.type = BREADCRUMB_TYPE;
    breadcrumb.timestamp = new Date(entry.timestamp);

    return breadcrumb;
  });

  event.breadcrumbs = [...kept, ...own].sort(
    (first, second) => first.timestamp.getTime() - second.timestamp.getTime(),
  );
};
