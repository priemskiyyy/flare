/**
 * Severity of a report. There is no `debug`: Flare reports failures and
 * abnormal conditions, it is not a logging product.
 *
 * @example
 * ```ts
 * flare.message("Unexpected payment state", { level: "warning" });
 * ```
 */
export type FlareLevel = "fatal" | "error" | "warning" | "info";
