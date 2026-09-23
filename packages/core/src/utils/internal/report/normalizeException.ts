import type { MappingLoss } from "src/types/MappingLoss";
import type { NormalizedError } from "src/types/NormalizedError";
import type { NormalizedException } from "src/types/NormalizedException";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import { sanitizeString } from "src/utils/internal/privacy/sanitizeString";

type Origin = NormalizedException["origin"];
type Described = { origin: Origin; error: NormalizedError };

const NON_ERROR_NAME = "NonError";
const FALLBACK_ERROR_NAME = "Error";
const NAME_LENGTH = 200;

const isObject = (value: unknown): value is object =>
  typeof value === "object" && value !== null;

// A thrown value is hostile input: a getter or a proxy trap can throw on any read.
const readProperty = (value: object, key: string): unknown => {
  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
};

// Only strings are kept. Coercing anything else would run its `toString`.
const readString = (value: object, key: string) => {
  const read = readProperty(value, key);

  if (typeof read !== "string") {
    return null;
  }

  return read;
};

const isInstanceOf = (
  value: object,
  constructor: abstract new (...parameters: never[]) => object,
) => {
  try {
    return value instanceof constructor;
  } catch {
    return false;
  }
};

const readKeys = (value: object) => {
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

const describeNonError = (origin: Origin, message: string): Described => ({
  origin,
  error: { name: NON_ERROR_NAME, message, stack: null },
});

// Keys say what was thrown without carrying any of its values into the message.
const describeObject = (value: object): Described => {
  const keys = readKeys(value);

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

  if (!isObject(thrown)) {
    return describeNonError("primitive", String(thrown));
  }

  const origin = getErrorOrigin(thrown);
  const name = readString(thrown, "name");

  // An Error from another realm fails `instanceof` but keeps its shape.
  if (origin === null && name === null) {
    return describeObject(thrown);
  }

  const message = readString(thrown, "message");

  if (origin === null && message === null) {
    return describeObject(thrown);
  }

  return {
    origin: origin ?? "error-like",
    error: {
      name: name === null || name === "" ? FALLBACK_ERROR_NAME : name,
      message: message ?? "",
      stack: readString(thrown, "stack"),
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

  while (isObject(current)) {
    const cause = readProperty(current, "cause");

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
  if (!isObject(thrown)) {
    return [];
  }

  const errors = readProperty(thrown, "errors");

  if (!Array.isArray(errors)) {
    return [];
  }

  const length = readProperty(errors, "length");

  if (typeof length !== "number") {
    return [];
  }

  if (length > limit) {
    losses.push({ path: "exception.aggregated", reason: "truncated" });
  }

  // Own the array: custom slice or species hooks must not bypass normalization.
  return Array.from({ length: Math.min(length, limit) }, (_, index) =>
    readProperty(errors, String(index)),
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

  const boundError = (error: NormalizedError, path: string): NormalizedError =>
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
      stack:
        error.stack === null
          ? null
          : sanitizeString(error.stack, {
              path: `${path}.stack`,
              maxLength: policy.limits.stackLength,
              scrub: policy.scrub,
              losses,
            }),
    });

  const described = describeThrown(thrown);
  const error = boundError(described.error, "exception");

  const causes = collectCauses(thrown, {
    limit: limits.causeDepth,
    losses,
  }).map((cause, index) =>
    boundError(describeThrown(cause).error, `exception.causes.${index}`),
  );

  const aggregated = collectAggregated(thrown, {
    limit: limits.aggregatedErrors,
    losses,
  }).map((error, index) =>
    boundError(describeThrown(error).error, `exception.aggregated.${index}`),
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
