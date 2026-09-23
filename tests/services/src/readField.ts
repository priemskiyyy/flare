/** One field of a JSON value the collector wrote, or `null` when it has none. */
export const readField = (value: unknown, key: string): unknown => {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return null;
  }

  return Reflect.get(value, key);
};
