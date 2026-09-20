/** The metadata section Flare's tags travel in. Bugsnag has no tags of its own. */
export const TAGS_SECTION = "tags";

/** The metadata section for what Flare knows about the report itself. */
export const FLARE_SECTION = "flare";

/** The metadata section for the errors of an AggregateError. */
export const AGGREGATED_SECTION = "flare.aggregated";

/** Report contexts must not replace metadata maintained by the adapter. */
export const RESERVED_SECTIONS: readonly string[] = [
  TAGS_SECTION,
  FLARE_SECTION,
  AGGREGATED_SECTION,
];

/** Stamped on every mirrored breadcrumb, because Bugsnag cannot clear them on an account change. */
export const GENERATION_KEY = "flare.generation";
