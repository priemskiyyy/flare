import type { SanitizedReport } from "@priemskiyyy/flare";

/**
 * What `request` receives for one report: the frozen, sanitized report, and
 * a signal that aborts at the deadline and on disposal.
 *
 * @example
 * ```ts
 * const request = async ({ report, signal }: HttpRequest) => {
 *   await fetch("/api/error-reports", { method: "POST", body: JSON.stringify(report), signal });
 * };
 * ```
 */
export type HttpRequest = {
  report: SanitizedReport;
  signal: AbortSignal;
};
