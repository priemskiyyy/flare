/**
 * The attribute a report's own data travels under, so that it never mixes
 * with the application's global context, which sits beside it in every log.
 */
export const FLARE_ATTRIBUTE = "flare";

/** Datadog's merge skips this name at every depth, to keep prototypes intact. */
export const PROTOTYPE_KEY = "__proto__";
