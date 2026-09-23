import type { TagValue } from "src/types/TagValue";

export const isTagValue = (value: unknown): value is TagValue => {
  if (typeof value === "string") {
    return true;
  }

  if (typeof value === "boolean") {
    return true;
  }

  // NaN and Infinity cannot be indexed or serialized by any provider.
  return typeof value === "number" && Number.isFinite(value);
};
