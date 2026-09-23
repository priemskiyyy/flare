import type { NormalizedError } from "src/types/NormalizedError";

// `{ cause: undefined }` would still give the error a `cause` of its own.
const getCauseOptions = (
  causes: readonly NormalizedError[],
): ErrorOptions | undefined => {
  const [nearest, ...further] = causes;

  if (nearest === undefined) {
    return undefined;
  }

  return { cause: new SanitizedError({ ...nearest, causes: further }) };
};

/**
 * An `Error` built from a sanitized exception, with its cause chain, for a
 * provider SDK that takes nothing else. The thrown value itself never reaches
 * an adapter, so this is the only Error an adapter can hand over, and it
 * carries nothing the core did not redact and bound first. Its `name` is the
 * original one, so a provider shows the error's own type.
 *
 * @example
 * ```ts
 * submit: (report) => {
 *   if (report.kind === "exception") {
 *     sdk.captureException(new SanitizedError(report.exception));
 *   }
 * };
 * ```
 */
export class SanitizedError extends Error {
  constructor({
    name,
    message,
    stack,
    causes = [],
  }: NormalizedError & { causes?: readonly NormalizedError[] }) {
    super(message, getCauseOptions(causes));
    this.name = name;
    // Without a stack of its own, the constructor would leave frames that
    // point at the adapter. A header alone gives a provider a type and a value.
    this.stack = stack ?? `${name}: ${message}`;
  }
}
