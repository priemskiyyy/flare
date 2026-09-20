/**
 * Why a report never reached routing.
 *
 * - `stale-scope`: captured through a scope created under a previous identity.
 * - `sanitizer-failed`: the `scrub` option threw, so the report failed closed.
 * - `route-failed`: the `route` option threw or named an unknown destination.
 * - `no-destinations`: routing selected nothing.
 * - `reentrant`: captured synchronously from inside an adapter's `submit`.
 * - `rate-limited`: over `limits.reportsPerMinute`.
 * - `disposed`: captured after `dispose()`.
 */
export type ReportDropReason =
  | "stale-scope"
  | "sanitizer-failed"
  | "route-failed"
  | "no-destinations"
  | "reentrant"
  | "rate-limited"
  | "disposed";
