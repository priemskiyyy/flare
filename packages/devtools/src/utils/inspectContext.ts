import { isSensitiveKey } from "@priemskiyyy/flare";

/** Reads descriptors to avoid invoking getters or toJSON while inspecting diagnostics. */
export const inspectContext = (context: unknown) => {
  const seen = new WeakSet<object>();
  let remaining = 200;

  const inspect = (value: unknown, depth: number): unknown => {
    remaining -= 1;

    if (remaining < 0 || depth > 6) {
      return "[Truncated]";
    }

    if (typeof value === "string") {
      if (value.length <= 2_000) {
        return value;
      }

      return `${value.slice(0, 2_000)}… [Truncated]`;
    }

    if (typeof value === "bigint") {
      return `${value}n`;
    }

    if (typeof value === "function" || typeof value === "symbol") {
      return `[${typeof value}]`;
    }

    if (typeof value !== "object" || value === null) {
      return value;
    }

    if (seen.has(value)) {
      return "[Circular or repeated reference]";
    }

    seen.add(value);

    const entries = Object.entries(Object.getOwnPropertyDescriptors(value));
    const result: Record<string, unknown> = Object.create(null);

    for (const [key, descriptor] of entries.slice(0, 50)) {
      if (remaining < 0) {
        result["…"] = "[Truncated]";
        break;
      }

      if (isSensitiveKey(key)) {
        result[key] = "[Redacted]";
        continue;
      }

      if (!("value" in descriptor)) {
        result[key] = "[Accessor]";
        continue;
      }

      result[key] = inspect(descriptor.value, depth + 1);
    }

    if (entries.length > 50) {
      result["…"] = "[Truncated]";
    }

    if (Array.isArray(value)) {
      return Object.entries(result)
        .filter(([key]) => key !== "length")
        .map(([, item]) => item);
    }

    return result;
  };

  return inspect(context, 0);
};
