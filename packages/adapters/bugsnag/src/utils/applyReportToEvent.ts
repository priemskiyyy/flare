import type { SanitizedReport } from "@priemskiyyy/flare";

import type { BugsnagBreadcrumbConstructorLike } from "src/types/BugsnagBreadcrumbConstructorLike";
import type { BugsnagEventLike } from "src/types/BugsnagEventLike";
import {
  AGGREGATED_SECTION,
  FLARE_SECTION,
  GENERATION_KEY,
  RESERVED_SECTIONS,
  TAGS_SECTION,
} from "src/utils/constants/metadata";

type Options = {
  Breadcrumb: BugsnagBreadcrumbConstructorLike | undefined;
  /** Sections the ambient integration wrote to the client, which every event starts with a copy of. */
  mirroredSections: string[];
};

const replaceSection = (
  event: BugsnagEventLike,
  section: string,
  values: Record<string, unknown>,
) => {
  // addMetadata merges into a section; a Flare context replaces by name.
  event.clearMetadata(section);
  event.addMetadata(section, { ...values });
};

const writeBreadcrumbs = (
  event: BugsnagEventLike,
  report: SanitizedReport,
  { Breadcrumb }: Options,
) => {
  // The client holds submission-time history, including other accounts.
  // Keep provider breadcrumbs and replace Flare's part with the snapshot.
  event.breadcrumbs = event.breadcrumbs.filter(
    (breadcrumb) => breadcrumb.metadata[GENERATION_KEY] === undefined,
  );

  if (Breadcrumb === undefined) {
    return;
  }

  const own = report.breadcrumbs.map((entry) => {
    const breadcrumb = new Breadcrumb();

    breadcrumb.message = entry.name;
    breadcrumb.metadata = { ...entry.data };
    breadcrumb.type = "manual";
    breadcrumb.timestamp = new Date(entry.timestamp);

    return breadcrumb;
  });

  event.breadcrumbs = [...event.breadcrumbs, ...own].sort(
    (first, second) => first.timestamp.getTime() - second.timestamp.getTime(),
  );
};

/**
 * Writes one report onto the event of one `notify` call. The user is always
 * written, cleared included: an anonymous report must not inherit whoever the
 * client still names.
 */
export const applyReportToEvent = (
  event: BugsnagEventLike,
  report: SanitizedReport,
  options: Options,
) => {
  // What the mirror wrote describes the current account. This report may have
  // been captured under another one, so it starts from none of it.
  for (const section of options.mirroredSections) {
    event.clearMetadata(section);
  }

  const { user } = report.identity;

  event.setUser(user?.id, user?.email, user?.name);
  // Bugsnag has three severities, so only fatal needs translation.
  event.severity = report.level === "fatal" ? "error" : report.level;

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

    replaceSection(event, name, context);
  }

  replaceSection(event, FLARE_SECTION, {
    reportId: report.id,
    level: report.level,
  });

  if (report.kind === "exception" && report.exception.aggregated.length > 0) {
    replaceSection(event, AGGREGATED_SECTION, {
      errors: report.exception.aggregated.map(({ name, message }) => ({
        name,
        message,
      })),
    });
  }

  writeBreadcrumbs(event, report, options);
};
