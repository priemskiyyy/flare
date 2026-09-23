import type { FlareUser } from "src/types/FlareUser";
import type { MappingLoss } from "src/types/MappingLoss";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import { isRecord } from "src/utils/common/isRecord";
import { sanitizeValue } from "src/utils/internal/privacy/sanitizeValue";

type PreparedUser = {
  user: FlareUser | null;
  /** The real id, kept in memory only, so redaction cannot merge two accounts. */
  identity: string | null;
  losses: readonly MappingLoss[];
};

const SIGNED_OUT: PreparedUser = Object.freeze({
  user: null,
  identity: null,
  losses: Object.freeze([]),
});

// An empty id names no account. It signs out: keeping the previous account
// would attribute the next reports to someone who may no longer be signed in.
const INVALID: PreparedUser = Object.freeze({
  user: null,
  identity: null,
  losses: Object.freeze([Object.freeze({ path: "user", reason: "invalid" })]),
});

/** Redacts and bounds a user. The scrubber never rewrites identity fields. */
export const prepareUser = (
  user: FlareUser | null,
  policy: PrivacyPolicy,
): PreparedUser => {
  if (user === null) {
    return SIGNED_OUT;
  }

  const { id, email, name } = user;

  if (id === "") {
    return INVALID;
  }

  // Only these three are identity data, and an absent one takes no budget.
  const identityFields: FlareUser = { id };

  if (email !== undefined) {
    identityFields.email = email;
  }

  if (name !== undefined) {
    identityFields.name = name;
  }

  const redacted = sanitizeValue(identityFields, "user", {
    ...policy,
    scrub: null,
  });

  const { value, losses } = redacted;

  // A rule naming the whole user, or its id, leaves a marker instead of an account.
  if (!isRecord(value) || typeof value.id !== "string") {
    return { user: null, identity: id, losses };
  }

  const prepared: FlareUser = { id: value.id };

  if (typeof value.email === "string") {
    prepared.email = value.email;
  }

  if (typeof value.name === "string") {
    prepared.name = value.name;
  }

  return { user: Object.freeze(prepared), identity: id, losses };
};
