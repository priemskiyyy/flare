import type { FlareErrorCode } from "src/types/FlareErrorCode";

// `{ cause: undefined }` would still give the error a `cause` of its own.
const getErrorOptions = (cause: unknown): ErrorOptions | undefined => {
  if (cause === undefined) {
    return undefined;
  }

  return { cause };
};

/**
 * An error Flare itself created, with a code to branch on. An error that a
 * provider SDK or your own code threw reaches a receipt exactly as it was
 * thrown, and is never wrapped in one of these, except as its `cause`.
 *
 * @example
 * ```ts
 * const current = flare.destination("sentry").status.get();
 * if (current.state === "failed" && current.error instanceof FlareError) {
 *   console.warn(current.error.code, current.error.message);
 * }
 * ```
 */
export class FlareError extends Error {
  readonly code: FlareErrorCode;

  constructor({
    code,
    message,
    cause,
  }: {
    code: FlareErrorCode;
    message: string;
    cause?: unknown;
  }) {
    super(message, getErrorOptions(cause));
    this.name = "FlareError";
    this.code = code;
  }
}
