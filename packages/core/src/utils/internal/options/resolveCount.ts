import { FlareError } from "src/utils/FlareError";

/** A count option as given, or its default when it was left out. */
export const resolveCount = (
  name: string,
  value: number | undefined,
  fallback: number,
) => {
  const count = value ?? fallback;

  if (!Number.isInteger(count) || count < 0) {
    throw new FlareError({
      code: "INVALID_CONFIGURATION",
      message: `${name} must be a whole number of 0 or more.`,
    });
  }

  return count;
};
