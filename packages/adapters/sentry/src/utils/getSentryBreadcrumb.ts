import type { Breadcrumb } from "@priemskiyyy/flare";

import type { SentryEventLike } from "src/types/SentryEventLike";
import { BREADCRUMB_CATEGORY } from "src/utils/constants/event";

type SentryBreadcrumb = NonNullable<SentryEventLike["breadcrumbs"]>[number];

export const getSentryBreadcrumb = (breadcrumb: Breadcrumb) => {
  const sentryBreadcrumb: SentryBreadcrumb = {
    category: BREADCRUMB_CATEGORY,
    message: breadcrumb.name,
    level: "info",
    // Sentry counts in seconds.
    timestamp: breadcrumb.timestamp / 1_000,
  };

  if (breadcrumb.data !== null) {
    sentryBreadcrumb.data = breadcrumb.data;
  }

  return sentryBreadcrumb;
};
