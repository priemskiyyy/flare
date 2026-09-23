/**
 * Why a report never reached a destination.
 *
 * - `stale-scope`: captured through a scope created under a previous identity.
 * - `sanitizer-failed`: its data could not be sanitized, so it failed closed:
 *   `redact` or `scrub` threw, `scrub` returned no string, or a capture
 *   option's getter threw.
 * - `route-failed`: the `defaults.to` function threw, or a report was sent
 *   to a destination that does not exist.
 * - `no-destinations`: routing selected nothing.
 * - `reentrant`: captured synchronously from inside an adapter's `submit`.
 * - `rate-limited`: over `rateLimits.perMinute`.
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
