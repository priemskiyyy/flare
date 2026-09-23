/**
 * The context attribute a report's own data travels under. Datadog merges its
 * global context over an error's attributes, so data at the top of the
 * context would lose to the application's global context of the same name.
 * Under one name, only that name is shared.
 */
export const FLARE_ATTRIBUTE = "flare";

/** Datadog's merge skips this name at every depth, to keep prototypes intact. */
export const PROTOTYPE_KEY = "__proto__";
