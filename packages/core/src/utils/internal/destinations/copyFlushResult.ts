import type { FlushResult } from "src/types/FlushResult";
import { FlareError } from "src/utils/FlareError";

const INVALID_ANSWER = () =>
  new FlareError({
    code: "INVALID_ANSWER",
    message: "The adapter answered flush with no status its contract allows.",
  });

/** What a flush result publishes: the fields its status allows, copied and frozen. */
export const copyFlushResult = (result: FlushResult): FlushResult => {
  // A JavaScript adapter can answer anything.
  if (typeof result !== "object" || result === null) {
    throw INVALID_ANSWER();
  }

  if (result.status === "flushed" || result.status === "timeout") {
    return Object.freeze({ status: result.status });
  }

  if (result.status === "failed") {
    return Object.freeze({ status: "failed", error: result.error });
  }

  throw INVALID_ANSWER();
};
