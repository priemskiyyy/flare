import { MAX_TIMEOUT } from "src/utils/constants/defaults";
import { FlareError } from "src/utils/FlareError";

/** A duration option in milliseconds as given, or its default when it was left out. */
export const resolveDuration = (
  name: string,
  value: number | undefined,
  fallback: number,
) => {
  const duration = value ?? fallback;

  if (Number.isNaN(duration) || duration < 0 || duration > MAX_TIMEOUT) {
    throw new FlareError({
      code: "INVALID_CONFIGURATION",
      message: `${name} must be a number of milliseconds from 0 to ${MAX_TIMEOUT}.`,
    });
  }

  return duration;
};
