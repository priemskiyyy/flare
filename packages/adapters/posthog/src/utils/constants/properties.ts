/** Flare's report id on every event, so an event can be found from its receipt. */
export const REPORT_ID_PROPERTY = "flare.report_id";

/** The operation a report was captured during. PostHog has no field of its own for it. */
export const OPERATION_PROPERTY = "flare.operation";

/** The errors of an AggregateError. PostHog records one exception and its causes. */
export const AGGREGATED_PROPERTY = "flare.aggregated";

/**
 * Names a report's tags and contexts cannot take. PostHog merges an event's
 * properties over its own, so `distinct_id` would move the event to another
 * person and `token` is overwritten, while `__proto__` does not survive that
 * merge. Every `$` name belongs to PostHog as well, and `$set`, for example,
 * changes the person.
 */
export const RESERVED_PROPERTIES: readonly string[] = [
  "distinct_id",
  "token",
  "__proto__",
  REPORT_ID_PROPERTY,
  OPERATION_PROPERTY,
  AGGREGATED_PROPERTY,
];

/** The fields PostHog reads from an exception step. They win over a breadcrumb's data. */
export const STEP_FIELDS: readonly string[] = ["$message", "$timestamp"];
