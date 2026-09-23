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
  const value: Record<string, Record<string, unknown>> = Object.create(null);
  const losses: MappingLoss[] = [];

  for (const [name, raw] of Object.entries(contexts)) {
    const path = `contexts.${name}`;
    const validation = validateDeclared(declared, name, raw);

    if (!validation.valid || !isRecord(validation.value)) {
      losses.push({ path, reason: "invalid" });
      continue;
    }

    const sanitized = sanitizeValue(validation.value, path, policy);

    losses.push(...sanitized.losses);

    // A path rule naming the whole context leaves a marker, not an object.
    if (!isRecord(sanitized.value)) {
      continue;
    }

    value[name] = sanitized.value;
  }

  return { value: Object.freeze(value), losses };
};
