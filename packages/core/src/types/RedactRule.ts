/**
 * Names data that must never leave the application. A string matches a key
 * exactly, ignoring case, or a full dotted path such as `contexts.upload.note`.
 * It is never a substring match: use a `RegExp`, tested against the key, for
 * anything looser.
 *
 * @example
 * ```ts
 * const redact: RedactRule[] = ["ssn", "contexts.billing.card", /^x-internal-/i];
 * ```
 */
export type RedactRule = string | RegExp;
