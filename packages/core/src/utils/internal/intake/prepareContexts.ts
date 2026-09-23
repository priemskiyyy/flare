import type { FlareSchema } from "src/types/FlareSchema";
import type { MappingLoss } from "src/types/MappingLoss";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import { isRecord } from "src/utils/common/isRecord";
import { sanitizeValue } from "src/utils/internal/privacy/sanitizeValue";
import { validateDeclared } from "src/utils/internal/schema/validateDeclared";

/** Validates, redacts and bounds contexts. An invalid context costs only itself. */
export const prepareContexts = (
  contexts: Record<string, unknown>,
  declared: FlareSchema["contexts"],
  policy: PrivacyPolicy,
): {
  value: Record<string, Record<string, unknown>>;
  losses: MappingLoss[];
} => {
  const value: Array<[string, Record<string, unknown>]> = [];
  const losses: MappingLoss[] = [];

  for (const [name, raw] of Object.entries(contexts)) {
    const path = `contexts.${name}`;
    const validation = validateDeclared(declared, name, raw);

    if (!validation.valid || !isRecord(validation.value)) {
      losses.push({ path, reason: "invalid" });
      continue;
    }

    // A context the predicate names is left out whole.
    if (policy.redact(name, path)) {
      continue;
    }

    const sanitized = sanitizeValue(validation.value, path, policy);

    losses.push(...sanitized.losses);

    if (!isRecord(sanitized.value)) {
      continue;
    }

    value.push([name, sanitized.value]);
  }

  return { value: Object.freeze(Object.fromEntries(value)), losses };
};
