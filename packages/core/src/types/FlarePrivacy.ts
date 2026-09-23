import type { FlareLimits } from "src/types/FlareLimits";

/**
 * What must never leave the application, applied before anything is retained,
 * buffered, observed or sent.
 *
 * @example
 * ```ts
 * privacy: {
 *   redact: (key) => isSensitiveKey(key) || key === "ssn",
 *   scrub: (text) => text.replace(EMAIL, "[email]"),
 * }
 * ```
 */
export type FlarePrivacy = {
  /**
   * Decides which values are replaced with `[Redacted]`. It is asked about
   * every key in tags, contexts, breadcrumb data and the user, with its dotted
   * path, such as `iban` at `contexts.payment.iban`, and about each context and
   * breadcrumb by its name. Omitted, `isSensitiveKey` decides. It must be
   * synchronous and cheap. If it throws, the data it was deciding about is
   * dropped rather than sent.
   */
  redact?: (key: string, path: string) => boolean;
  /**
   * Rewrites free text: messages, exceptions, the operation, breadcrumb names
   * and every string value in tags, contexts and breadcrumb data. It must
   * return a string. If it throws, the data it was given is dropped rather
   * than sent unscrubbed.
   */
  scrub?: (text: string, path: string) => string;
  limits?: Partial<FlareLimits>;
};
