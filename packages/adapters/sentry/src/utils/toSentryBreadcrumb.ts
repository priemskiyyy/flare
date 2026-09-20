import type { Breadcrumb } from "@priemskiyyy/flare";

export const toSentryBreadcrumb = (breadcrumb: Breadcrumb) => ({
  category: "flare",
  message: breadcrumb.name,
  level: "info" as const,
  ...(breadcrumb.data === null ? {} : { data: breadcrumb.data }),
  // Sentry counts in seconds.
  timestamp: breadcrumb.timestamp / 1_000,
});
