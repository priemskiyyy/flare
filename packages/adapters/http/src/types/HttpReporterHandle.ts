/**
 * The native handle of the http reporter: where it posts to.
 *
 * @example
 * ```ts
 * flare.destination("backend").native?.endpoint; // "/api/error-reports"
 * ```
 */
export type HttpReporterHandle = {
  endpoint: string;
};
