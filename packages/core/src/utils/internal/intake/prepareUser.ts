import type { FlareUser } from "src/types/FlareUser";
import type { MappingLoss } from "src/types/MappingLoss";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import { isRecord } from "src/utils/common/isRecord";
import { sanitizeValue } from "src/utils/internal/privacy/sanitizeValue";

type PreparedUser = {
  user: FlareUser | null;
  /** The real id, kept in memory only, so redaction cannot merge two accounts. */
  identity: string | null;
  losses: MappingLoss[];
};

const SIGNED_OUT: PreparedUser = { user: null, identity: null, losses: [] };

// An unusable user signs out: keeping the previous account would attribute
// the next reports to someone who may no longer be signed in.
const INVALID: PreparedUser = {
  user: null,
  identity: null,
  losses: [{ path: "user", reason: "invalid" }],
};

const OPTIONAL_FIELDS = ["email", "name"] as const;

const readFields = (user: unknown): Record<string, unknown> | null => {
  try {
    if (!isRecord(user)) {
      return null;
    }

    // Accessors are never identity data.
    return {
      id: Object.getOwnPropertyDescriptor(user, "id")?.value,
      email: Object.getOwnPropertyDescriptor(user, "email")?.value,
      name: Object.getOwnPropertyDescriptor(user, "name")?.value,
    };
  } catch {
    return null;
  }
};

/** Validates and redacts a user. The scrubber never rewrites identity fields. */
export const prepareUser = (
  user: unknown,
  policy: PrivacyPolicy,
): PreparedUser => {
  if (user === null) {
    return SIGNED_OUT;
  }

  const fields = readFields(user);

  if (fields === null) {
    return INVALID;
  }

  // Keep the full id only for identity comparison. Bounds apply to the report.
  const { id } = fields;

  if (typeof id !== "string" || id === "") {
    return INVALID;
  }

  const candidate: Record<string, string> = { id };
  const losses: MappingLoss[] = [];

  for (const field of OPTIONAL_FIELDS) {
    const value = fields[field];

    if (value === undefined) {
      continue;
    }

    if (typeof value !== "string") {
      losses.push({ path: `user.${field}`, reason: "invalid" });
      continue;
    }

    candidate[field] = value;
  }

  const redacted = sanitizeValue(candidate, "user", { ...policy, scrub: null });

  losses.push(...redacted.losses);

  if (!isRecord(redacted.value)) {
    return { user: null, identity: id, losses };
  }

  const redactedId = redacted.value.id;

  if (typeof redactedId !== "string") {
    return { user: null, identity: id, losses };
  }

  const prepared: FlareUser = { id: redactedId };

  for (const field of OPTIONAL_FIELDS) {
    const value = redacted.value[field];

    if (typeof value === "string") {
      prepared[field] = value;
    }
  }

  return { user: Object.freeze(prepared), identity: id, losses };
};
