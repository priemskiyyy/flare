import type { MappingLoss } from "src/types/MappingLoss";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import { isInstanceOf } from "src/utils/common/isInstanceOf";
import { REDACTED } from "src/utils/constants/privacy";
import { sanitizeString } from "src/utils/internal/privacy/sanitizeString";

type Walk = {
  policy: PrivacyPolicy;
  // Ancestors only: an object reused by two siblings is not a cycle.
  ancestors: Set<object>;
  remaining: number;
  losses: MappingLoss[];
};

const OMIT = Symbol("omit");

const recordTruncation = (walk: Walk, path: string) => {
  walk.losses.push({ path, reason: "truncated" });
};

const spendBudget = (walk: Walk, cost: number) => {
  if (cost > walk.remaining) {
    walk.remaining = 0;

    return false;
  }

  walk.remaining -= Math.max(1, cost);

  return true;
};

type Constructor = abstract new (...parameters: never[]) => object;

// The native method, so a subclass cannot run its own code here.
const describeDate = (date: Date) => {
  try {
    return Date.prototype.toISOString.call(date);
  } catch {
    return "[Invalid Date]";
  }
};

const describeUrl = (url: URL) => {
  try {
    return URL.prototype.toString.call(url);
  } catch {
    return "[Invalid URL]";
  }
};

// These keep their content outside their own properties, where a copy would
// find an empty object, so only their kind is kept.
const OPAQUE_BUILT_INS: ReadonlyArray<readonly [Constructor, string]> = [
  [Map, "[Map]"],
  [Set, "[Set]"],
  [WeakMap, "[WeakMap]"],
  [WeakSet, "[WeakSet]"],
  [Promise, "[Promise]"],
  [RegExp, "[RegExp]"],
  [Error, "[Error]"],
  [ArrayBuffer, "[Binary]"],
];

// A revoked proxy throws even here.
const readIsArray = (value: object) => {
  try {
    return Array.isArray(value);
  } catch {
    return null;
  }
};

const describeOpaqueBuiltIn = (value: object) => {
  if (ArrayBuffer.isView(value)) {
    return "[Binary]";
  }

  for (const [constructor, marker] of OPAQUE_BUILT_INS) {
    if (isInstanceOf(value, constructor)) {
      return marker;
    }
  }

  return null;
};

const readObjectDescriptors = (value: object, limit: number) => {
  try {
    const entries: Array<[string, PropertyDescriptor]> = [];

    // Retain a snapshot before scrubbing, without copying every input descriptor.
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key);

      if (descriptor?.enumerable !== true) {
        continue;
      }

      if (entries.length >= limit) {
        return { entries, truncated: true };
      }

      entries.push([key, descriptor]);
    }

    return { entries, truncated: false };
  } catch {
    return null;
  }
};

const readArrayDescriptors = (value: object, limit: number) => {
  try {
    const length: unknown = Object.getOwnPropertyDescriptor(
      value,
      "length",
    )?.value;

    if (typeof length !== "number") {
      return null;
    }

    // Snapshot only the retained prefix before any scrubber can change the input.
    const items = Array.from({ length: Math.min(length, limit) }, (_, index) =>
      Object.getOwnPropertyDescriptor(value, index),
    );

    return { length, items };
  } catch {
    return null;
  }
};

const sanitizeArray = (
  walk: Walk,
  value: object,
  path: string,
  depth: number,
) => {
  const array = readArrayDescriptors(value, walk.policy.limits.breadth);

  if (array === null) {
    return "[Unreadable]";
  }

  if (array.length > array.items.length) {
    recordTruncation(walk, path);
  }

  const result = array.items.map((descriptor, index) => {
    if (descriptor === undefined) {
      return null;
    }

    const sanitized = sanitizeProperty(
      walk,
      descriptor,
      String(index),
      `${path}.${index}`,
      depth,
    );

    // An array keeps its positions, so what an object would omit becomes null.
    if (sanitized === OMIT) {
      return null;
    }

    return sanitized;
  });

  return Object.freeze(result);
};

const sanitizeProperty = (
  walk: Walk,
  descriptor: PropertyDescriptor,
  key: string,
  path: string,
  depth: number,
) => {
  if (walk.policy.redact(key, path)) {
    return REDACTED;
  }

  // Reading an accessor would run application code inside the reporter.
  if (typeof descriptor.get === "function") {
    return "[Accessor]";
  }

  if (typeof descriptor.set === "function") {
    return "[Accessor]";
  }

  return sanitize(walk, descriptor.value, path, depth + 1);
};

const sanitizeObject = (
  walk: Walk,
  value: object,
  path: string,
  depth: number,
) => {
  const descriptors = readObjectDescriptors(value, walk.policy.limits.breadth);

  if (descriptors === null) {
    return "[Unreadable]";
  }

  if (descriptors.truncated) {
    recordTruncation(walk, path);
  }

  const entries: Array<[string, unknown]> = [];

  for (const [key, descriptor] of descriptors.entries) {
    if (!spendBudget(walk, key.length)) {
      recordTruncation(walk, path);
      break;
    }

    const sanitized = sanitizeProperty(
      walk,
      descriptor,
      key,
      `${path}.${key}`,
      depth,
    );

    if (sanitized === OMIT) {
      continue;
    }

    entries.push([key, sanitized]);
  }

  // An ordinary object, which every provider SDK accepts, whose keys are all
  // its own: `fromEntries` defines them, so `__proto__` is a key like any other.
  return Object.freeze(Object.fromEntries(entries));
};

const sanitizeContainer = (
  walk: Walk,
  value: object,
  path: string,
  depth: number,
) => {
  if (isInstanceOf(value, Date)) {
    return describeDate(value);
  }

  // Hermes has no URL unless the application installs one.
  if (typeof URL === "function" && isInstanceOf(value, URL)) {
    return sanitizeLeaf(walk, describeUrl(value), path);
  }

  const marker = describeOpaqueBuiltIn(value);

  if (marker !== null) {
    walk.losses.push({ path, reason: "unsupported" });

    return marker;
  }

  if (walk.ancestors.has(value)) {
    return "[Circular]";
  }

  if (depth >= walk.policy.limits.depth) {
    recordTruncation(walk, path);

    return "[Depth limit]";
  }

  const isArray = readIsArray(value);

  if (isArray === null) {
    return "[Unreadable]";
  }

  walk.ancestors.add(value);

  try {
    if (isArray) {
      return sanitizeArray(walk, value, path, depth);
    }

    return sanitizeObject(walk, value, path, depth);
  } finally {
    walk.ancestors.delete(value);
  }
};

const sanitizeLeaf = (walk: Walk, value: unknown, path: string) => {
  if (typeof value === "string") {
    return sanitizeString(value, {
      path,
      maxLength: walk.policy.limits.stringLength,
      scrub: walk.policy.scrub,
      losses: walk.losses,
    });
  }

  if (typeof value === "number") {
    // JSON has no NaN or Infinity, so their names are kept instead.
    if (!Number.isFinite(value)) {
      return String(value);
    }

    return value;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "function") {
    return "[Function]";
  }

  // What remains is a bigint or a symbol; both coerce without running user code.
  return String(value);
};

const sanitize = (
  walk: Walk,
  value: unknown,
  path: string,
  depth: number,
): unknown => {
  if (value === undefined) {
    return OMIT;
  }

  if (value === null) {
    return null;
  }

  if (walk.remaining <= 0) {
    recordTruncation(walk, path);

    return "[Size limit]";
  }

  if (typeof value === "object") {
    if (!spendBudget(walk, 2)) {
      recordTruncation(walk, path);

      return "[Size limit]";
    }

    return sanitizeContainer(walk, value, path, depth);
  }

  const leaf = sanitizeLeaf(walk, value, path);

  if (!spendBudget(walk, String(leaf).length)) {
    recordTruncation(walk, path);

    return "[Size limit]";
  }

  return leaf;
};

/**
 * Copies application data into frozen, bounded, redacted plain data. Reads
 * own data properties only, without invoking getters or serialization methods.
 * Unreadable proxy descriptors become a marker. A throwing `redact` or
 * `scrub` is deliberately not contained: the caller owns failing closed.
 */
export const sanitizeValue = (
  value: unknown,
  path: string,
  policy: PrivacyPolicy,
): { value: unknown; losses: MappingLoss[] } => {
  if (value === undefined || value === null) {
    return { value: null, losses: [] };
  }

  const walk: Walk = {
    policy,
    ancestors: new Set(),
    remaining: policy.limits.totalSize,
    losses: [],
  };

  return { value: sanitize(walk, value, path, 0), losses: walk.losses };
};
