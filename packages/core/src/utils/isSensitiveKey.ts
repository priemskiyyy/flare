import { SENSITIVE_KEY } from "src/utils/constants/privacy";

/**
 * The default redaction: a key that names a credential, such as `apiKey`,
 * `Authorization` or `session_id`. Compose it to extend the defaults.
 *
 * @example
 * ```ts
 * privacy: {
 *   redact: (key, path) =>
 *     isSensitiveKey(key) || key === "iban" || path === "contexts.customer.address",
 * }
 * ```
 */
export const isSensitiveKey = (key: string) => SENSITIVE_KEY.test(key);
