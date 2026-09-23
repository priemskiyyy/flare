import { isRecord } from "src/utils/common/isRecord";

/** A frozen copy of plain data, so whoever receives it cannot change what anyone else sees. */
export const copyFrozen = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => copyFrozen(item)));
  }

  if (!isRecord(value)) {
    return value;
  }

  const entries: Array<[string, unknown]> = [];

  for (const [key, nested] of Object.entries(value)) {
    entries.push([key, copyFrozen(nested)]);
  }

  return Object.freeze(Object.fromEntries(entries));
};
