/**
 * Where an adapter registers resources to release on startup rollback or disposal.
 *
 * @example
 * ```ts
 * lifetime.add(sdk.onError(handleError));
 * ```
 */
export type ReporterLifetime = {
  /** Runs once, in reverse registration order. Every cleanup is attempted. */
  add: (cleanup: () => void) => void;
};
