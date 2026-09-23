/**
 * What went wrong, for an error Flare itself created.
 *
 * - `INVALID_CONFIGURATION`: options that cannot work, such as an unknown
 *   destination name, or a hook used outside its provider.
 * - `NOT_INITIALIZED`: a destination's SDK was not set up before
 *   `flare.start()`. Start again once it is.
 * - `UNSUPPORTED`: the SDK lacks what the destination needs.
 * - `SUBMISSION_FAILED`: the SDK failed to take a report and kept its own
 *   error.
 * - `INVALID_ANSWER`: an adapter answered `open`, `submit` or `flush` with
 *   something its contract does not allow.
 *
 * @example
 * ```ts
 * const code: FlareErrorCode = "NOT_INITIALIZED";
 * ```
 */
export type FlareErrorCode =
  | "INVALID_CONFIGURATION"
  | "NOT_INITIALIZED"
  | "UNSUPPORTED"
  | "SUBMISSION_FAILED"
  | "INVALID_ANSWER";
