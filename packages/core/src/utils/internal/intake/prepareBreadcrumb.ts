import type { Breadcrumb } from "src/types/Breadcrumb";
import type { FlareSchema } from "src/types/FlareSchema";
import type { MappingLoss } from "src/types/MappingLoss";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import { isRecord } from "src/utils/common/isRecord";
import { sanitizeValue } from "src/utils/internal/privacy/sanitizeValue";
import { validateDeclared } from "src/utils/internal/schema/validateDeclared";

/** Validates, redacts and bounds one breadcrumb before it may be retained. */
export const prepareBreadcrumb = (
  breadcrumb: { name: string; data: unknown; timestamp: number },
  declared: FlareSchema["breadcrumbs"],
  policy: PrivacyPolicy,
): { value: Breadcrumb | null; losses: MappingLoss[] } => {
  const { name, timestamp } = breadcrumb;
  const path = `breadcrumbs.${name}`;
  const validation = validateDeclared(declared, name, breadcrumb.data);
  if (
    !validation.valid ||
    (validation.value !== undefined && !isRecord(validation.value))
  ) {
    return { value: null, losses: [{ path, reason: "invalid" }] };
  }

  const sanitized = sanitizeValue(validation.value, path, policy);
  return {
    value: Object.freeze({
      name,
      data: isRecord(sanitized.value) ? sanitized.value : null,
      timestamp,
    }),
    losses: sanitized.losses,
  };
};
