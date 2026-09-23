import type { StandardSchema } from "src/types/StandardSchema";
import { isPromiseLike } from "src/utils/common/isPromiseLike";

type Validation = { valid: true; value: unknown } | { valid: false };

/**
 * Validates one named value against a schema map. Without a map every name
 * is accepted as given; with one, only declared names are.
 */
export const validateDeclared = (
  declared: Record<string, StandardSchema<unknown>> | undefined,
  name: string,
  value: unknown,
): Validation => {
  if (declared === undefined) {
    return { valid: true, value };
  }

  try {
    if (!Object.hasOwn(declared, name)) {
      return { valid: false };
    }

    const schema = declared[name];

    if (schema === undefined) {
      return { valid: false };
    }

    const result = schema["~standard"].validate(value);

    if (isPromiseLike(result)) {
      // Capture is synchronous. Observe a rejected promise without retaining it.
      Promise.resolve(result).catch(() => {});

      return { valid: false };
    }

    if (result.issues !== undefined) {
      return { valid: false };
    }

    return { valid: true, value: result.value };
  } catch {
    return { valid: false };
  }
};
