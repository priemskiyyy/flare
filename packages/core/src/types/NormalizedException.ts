import type { NormalizedError } from "src/types/NormalizedError";

/**
 * What `capture(unknown)` makes of a thrown value. `origin` says how the value
 * was recognized, `causes` is the bounded `cause` chain from nearest to
 * furthest, and `aggregated` holds the first errors of an `AggregateError`.
 *
 * @example
 * ```ts
 * if (report.kind === "exception") {
 *   console.debug(report.exception.name, report.exception.causes.length);
 * }
 * ```
 */
export type NormalizedException = NormalizedError & {
  readonly origin:
    | "error"
    | "error-like"
    | "dom-exception"
    | "primitive"
    | "object"
    | "function"
    | "nullish";
  readonly causes: readonly NormalizedError[];
  readonly aggregated: readonly NormalizedError[];
};
