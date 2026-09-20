import type { MappingLoss } from "src/types/MappingLoss";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import type { RedactRule } from "src/types/RedactRule";
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

const matchesRule = (rule: RedactRule, key: string | null, path: string) => {
  if (typeof rule === "string") {
    if (rule === path) {
      return true;
    }
    if (key === null) {
      return false;
    }
    return rule.toLowerCase() === key.toLowerCase();
  }

  if (key === null) {
    return false;
  }

  // A global or sticky RegExp remembers where it stopped; every key starts over.
  rule.lastIndex = 0;
  return rule.test(key);
};

const isRedacted = (walk: Walk, key: string | null, path: string) =>
  walk.policy.redact.some((rule) => matchesRule(rule, key, path));

const truncated = (walk: Walk, path: string) => {
  walk.losses.push({ path, reason: "truncated" });
};

const spend = (walk: Walk, cost: number) => {
  if (cost > walk.remaining) {
    walk.remaining = 0;
    return false;
  }
  walk.remaining -= Math.max(1, cost);
  return true;
};

const describeDate = (date: Date) => {
  try {
    return Date.prototype.toISOString.call(date);
  } catch {
    return "[Invalid Date]";
  }
};

const isDate = (value: object): value is Date => {
  try {
    return value instanceof Date;
  } catch {
    return false;
  }
};

const readObjectDescriptors = (value: object, limit: number) => {
  try {
    const maxEntries = Number.isNaN(limit) ? 0 : Math.trunc(limit);
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
      if (entries.length >= maxEntries) {
        return { entries, truncated: true };
      }
      entries.push([key, descriptor]);
    }
    return { entries, truncated: false };
  } catch {
    return null;
  }
};

const readArrayDescriptors = (value: unknown[], limit: number) => {
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
  value: unknown[],
  path: string,
  depth: number,
) => {
  const array = readArrayDescriptors(value, walk.policy.limits.breadth);
  if (array === null) {
    return "[Unreadable]";
  }

  if (array.length > array.items.length) {
    truncated(walk, path);
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
    return sanitized === OMIT ? null : sanitized;
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
  if (isRedacted(walk, key, path)) {
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
    truncated(walk, path);
  }

  const result: Record<string, unknown> = Object.create(null);
  for (const [key, descriptor] of descriptors.entries) {
    if (!spend(walk, key.length)) {
      truncated(walk, path);
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
    result[key] = sanitized;
  }
  return Object.freeze(result);
};

const sanitizeContainer = (
  walk: Walk,
  value: object,
  path: string,
  depth: number,
) => {
  if (isDate(value)) {
    return describeDate(value);
  }

  if (walk.ancestors.has(value)) {
    return "[Circular]";
  }

  if (depth >= walk.policy.limits.depth) {
    truncated(walk, path);
    return "[Depth limit]";
  }

  walk.ancestors.add(value);
  try {
    if (Array.isArray(value)) {
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
    return Number.isFinite(value) ? value : String(value);
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
    truncated(walk, path);
    return "[Size limit]";
  }

  if (typeof value === "object") {
    if (!spend(walk, 2)) {
      truncated(walk, path);
      return "[Size limit]";
    }
    return sanitizeContainer(walk, value, path, depth);
  }

  const leaf = sanitizeLeaf(walk, value, path);
  if (!spend(walk, String(leaf).length)) {
    truncated(walk, path);
    return "[Size limit]";
  }
  return leaf;
};

/**
 * Copies application data into frozen, bounded, redacted plain data. Reads
 * own data properties only, without invoking getters or serialization methods.
 * Unreadable proxy descriptors become a marker. A throwing `scrub` is
 * deliberately not contained: the caller owns failing closed.
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
  if (isRedacted(walk, null, path)) {
    return { value: REDACTED, losses: [] };
  }
  return { value: sanitize(walk, value, path, 0), losses: walk.losses };
};
