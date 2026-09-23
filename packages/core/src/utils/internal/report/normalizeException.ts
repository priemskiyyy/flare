import type { MappingLoss } from "src/types/MappingLoss";
import type { NormalizedError } from "src/types/NormalizedError";
import type { NormalizedException } from "src/types/NormalizedException";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import { isInstanceOf } from "src/utils/common/isInstanceOf";
import { sanitizeString } from "src/utils/internal/privacy/sanitizeString";

type Origin = NormalizedException["origin"];
type Described = { origin: Origin; error: NormalizedError };

const NON_ERROR_NAME = "NonError";
const FALLBACK_ERROR_NAME = "Error";
const NAME_LENGTH = 200;

const isNonNullObject = (value: unknown): value is object =>
  typeof value === "object" && value !== null;

// A thrown value is hostile input: a getter or a proxy trap can throw on any read.
const readGuardedProperty = (value: object, key: string): unknown => {
  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
};

// Only strings are kept. Coercing anything else would run its `toString`.
const readStringProperty = (value: object, key: string) => {
  const read = readGuardedProperty(value, key);

  if (typeof read !== "string") {
    return null;
  }

  return read;
};

const readOwnKeys = (value: object) => {
  try {
    return Object.keys(value);
  } catch {
    return [];
  }
};

const getErrorOrigin = (value: object): Origin | null => {
  if (typeof DOMException === "function") {
    if (isInstanceOf(value, DOMException)) {
      return "dom-exception";
    }
  }

  if (isInstanceOf(value, Error)) {
    return "error";
  }

  return null;
};

// An Error without a usable name is still an Error to every provider.
const getErrorName = (name: string | null) => {
  if (name === null || name === "") {
    return FALLBACK_ERROR_NAME;
  }

  return name;
};

const describeNonError = (origin: Origin, message: string): Described => ({
  origin,
  error: { name: NON_ERROR_NAME, message, stack: null },
});

// Keys say what was thrown without carrying any of its values into the message.
const describeObject = (value: object): Described => {
  const keys = readOwnKeys(value);

  if (keys.length === 0) {
    return describeNonError("object", "Object thrown");
  }

  return describeNonError(
    "object",
    `Object thrown with keys: ${keys.join(", ")}`,
  );
};

const describeThrown = (thrown: unknown): Described => {
  if (thrown === null || thrown === undefined) {
    return describeNonError("nullish", String(thrown));
  }

  if (typeof thrown === "function") {
    return describeNonError("function", "Function thrown");
  }

  if (!isNonNullObject(thrown)) {
    return describeNonError("primitive", String(thrown));
  }

  const origin = getErrorOrigin(thrown);
  const name = readStringProperty(thrown, "name");

  // An Error from another realm fails `instanceof` but keeps its shape.
  if (origin === null && name === null) {
    return describeObject(thrown);
  }

  const message = readStringProperty(thrown, "message");

  if (origin === null && message === null) {
    return describeObject(thrown);
  }

  return {
    origin: origin ?? "error-like",
    error: {
      name: getErrorName(name),
      message: message ?? "",
      stack: readStringProperty(thrown, "stack"),
    },
  };
};

const collectCauses = (
  thrown: unknown,
  { limit, losses }: { limit: number; losses: MappingLoss[] },
): unknown[] => {
  const causes: unknown[] = [];
  const seen = new Set<unknown>([thrown]);
  let current = thrown;

  while (isNonNullObject(current)) {
    const cause = readGuardedProperty(current, "cause");

    if (cause === undefined || seen.has(cause)) {
      return causes;
    }

    if (causes.length === limit) {
      losses.push({ path: "exception.causes", reason: "truncated" });

      return causes;
    }

    causes.push(cause);
    seen.add(cause);
    current = cause;
  }

  return causes;
};

const collectAggregated = (
  thrown: unknown,
  { limit, losses }: { limit: number; losses: MappingLoss[] },
): unknown[] => {
  if (!isNonNullObject(thrown)) {
    return [];
  }

  const errors = readGuardedProperty(thrown, "errors");

  if (!Array.isArray(errors)) {
    return [];
  }

  const length = readGuardedProperty(errors, "length");

  if (typeof length !== "number") {
    return [];
  }

  if (length > limit) {
    losses.push({ path: "exception.aggregated", reason: "truncated" });
  }

  // Own the array: custom slice or species hooks must not bypass normalization.
  return Array.from({ length: Math.min(length, limit) }, (_, index) =>
    readGuardedProperty(errors, String(index)),
  );
};

/**
 * Turns any thrown value into bounded plain data. Reads only `name`,
 * `message`, `stack`, `cause` and `errors`, each behind a guard, and never
 * enumerates an Error, coerces an object, or calls `toJSON`. A throwing
 * `scrub` is deliberately not contained: the caller owns failing closed.
 */
export const normalizeException = (
  thrown: unknown,
  policy: PrivacyPolicy,
): { exception: NormalizedException; losses: MappingLoss[] } => {
  const { limits } = policy;
  const losses: MappingLoss[] = [];

  const sanitizeStack = (stack: string | null, path: string) => {
    if (stack === null) {
      return null;
    }

    return sanitizeString(stack, {
      path: `${path}.stack`,
      maxLength: policy.limits.stackLength,
      scrub: policy.scrub,
      losses,
    });
  };

  const sanitizeError = (
    error: NormalizedError,
    path: string,
  ): NormalizedError =>
    Object.freeze({
      name: sanitizeString(error.name, {
        path: `${path}.name`,
        maxLength: NAME_LENGTH,
        scrub: null,
        losses,
      }),
      message: sanitizeString(error.message, {
        path: `${path}.message`,
        maxLength: policy.limits.messageLength,
        scrub: policy.scrub,
        losses,
      }),
      stack: sanitizeStack(error.stack, path),
    });

  const described = describeThrown(thrown);
  const error = sanitizeError(described.error, "exception");

  const causes = collectCauses(thrown, {
    limit: limits.causeDepth,
    losses,
  }).map((cause, index) =>
    sanitizeError(describeThrown(cause).error, `exception.causes.${index}`),
  );

  const aggregated = collectAggregated(thrown, {
    limit: limits.aggregatedErrors,
    losses,
  }).map((error, index) =>
    sanitizeError(describeThrown(error).error, `exception.aggregated.${index}`),
  );

  return {
    exception: Object.freeze({
      ...error,
      origin: described.origin,
      causes: Object.freeze(causes),
      aggregated: Object.freeze(aggregated),
    }),
    losses,
  };
};
