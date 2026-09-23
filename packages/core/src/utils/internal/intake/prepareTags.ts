import type { FlareSchema } from "src/types/FlareSchema";
import type { MappingLoss } from "src/types/MappingLoss";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import type { TagValue } from "src/types/TagValue";
import { isRecord } from "src/utils/common/isRecord";
import { isTagValue } from "src/utils/internal/intake/isTagValue";
import { sanitizeValue } from "src/utils/internal/privacy/sanitizeValue";
import { validateDeclared } from "src/utils/internal/schema/validateDeclared";

/** Validates, redacts and bounds tags. An invalid tag costs only itself. */
export const prepareTags = (
  tags: Record<string, unknown>,
  declared: FlareSchema["tags"],
  policy: PrivacyPolicy,
): { value: Record<string, TagValue>; losses: MappingLoss[] } => {
  const accepted: Array<[string, TagValue]> = [];
  const losses: MappingLoss[] = [];

  for (const [key, raw] of Object.entries(tags)) {
    const validation = validateDeclared(declared, key, raw);

    if (!validation.valid || !isTagValue(validation.value)) {
      losses.push({ path: `tags.${key}`, reason: "invalid" });
      continue;
    }

    accepted.push([key, validation.value]);
  }

  const sanitized = sanitizeValue(Object.fromEntries(accepted), "tags", policy);
  const value: Array<[string, TagValue]> = [];

  if (isRecord(sanitized.value)) {
    for (const [key, tag] of Object.entries(sanitized.value)) {
      if (isTagValue(tag)) {
        value.push([key, tag]);
      }
    }
  }

  return {
    value: Object.freeze(Object.fromEntries(value)),
    losses: [...losses, ...sanitized.losses],
  };
};
