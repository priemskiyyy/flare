export const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object") {
    return false;
  }
  if (value === null) {
    return false;
  }
  return !Array.isArray(value);
};
