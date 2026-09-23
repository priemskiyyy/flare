/** The tag every report's id travels in, so an event can be found from its receipt. */
export const REPORT_ID_TAG = "flare.report_id";

/** The context for the errors of an AggregateError. Sentry has no field for them. */
export const AGGREGATED_CONTEXT = "flare.aggregated";

/** The category of every breadcrumb Flare writes, which tells them from Sentry's own. */
export const BREADCRUMB_CATEGORY = "flare";
