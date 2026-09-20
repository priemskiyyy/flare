import type { NormalizedError } from "src/types/NormalizedError";
import type { NormalizedException } from "src/types/NormalizedException";

const rebuild = (normalized: NormalizedError, cause: Error | undefined) => {
  const error =
    cause === undefined
      ? new Error(normalized.message)
      : new Error(normalized.message, { cause });
  error.name = normalized.name;
  // Without a stack of its own, `new Error` would leave frames that point at
  // the caller. A header alone gives a provider a type and a value.
  error.stack = normalized.stack ?? `${normalized.name}: ${normalized.message}`;
  return error;
};

/**
 * Rebuilds an `Error` from a sanitized exception, with its cause chain, for a
 * provider SDK that only accepts one. The thrown value itself never reaches
 * an adapter, so this is the only Error an adapter can hand over, and it
 * carries nothing the core did not redact and bound first.
 *
 * @example
 * ```ts
 * submit: (report) => {
 *   if (report.kind === "exception") {
 *     sdk.captureException(rebuildError(report.exception));
 *   }
 * };
 * ```
 */
export const rebuildError = (exception: NormalizedException) => {
  let cause: Error | undefined = undefined;
  for (const normalized of [...exception.causes].reverse()) {
    cause = rebuild(normalized, cause);
  }
  return rebuild(exception, cause);
};
