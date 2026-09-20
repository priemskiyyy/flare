import type { FlareLimits } from "src/types/FlareLimits";
import type { RedactRule } from "src/types/RedactRule";

/**
 * What must never leave the application, applied before anything is retained,
 * buffered, observed or sent. Omitting `redact` applies `DEFAULT_REDACT`;
 * passing it replaces the defaults, so spread them in to extend them.
 *
 * @example
 * ```ts
 * privacy: {
 *   redact: [...DEFAULT_REDACT, "ssn", "contexts.billing"],
 *   scrub: (text) => text.replace(EMAIL, "[email]"),
 * }
 * ```
 */
export type FlarePrivacy = {
  redact?: RedactRule[];
  /**
   * Rewrites free text: messages, stacks, string tags and every string inside
   * a context or breadcrumb. It must return a string. If it throws, the data
   * it was given is dropped rather than sent unscrubbed.
   */
  scrub?: (text: string, path: string) => string;
  limits?: Partial<FlareLimits>;
};
