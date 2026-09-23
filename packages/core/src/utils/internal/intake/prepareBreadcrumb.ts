import type { Breadcrumb } from "src/types/Breadcrumb";
import type { FlareSchema } from "src/types/FlareSchema";
import type { MappingLoss } from "src/types/MappingLoss";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import { isRecord } from "src/utils/common/isRecord";
import { sanitizeString } from "src/utils/internal/privacy/sanitizeString";
import { sanitizeValue } from "src/utils/internal/privacy/sanitizeValue";
import { validateDeclared } from "src/utils/internal/schema/validateDeclared";

/** Validates, redacts and bounds one breadcrumb before it may be retained. */
export const prepareBreadcrumb = (
  breadcrumb: { name: string; data: unknown; timestamp: number },
  declared: FlareSchema["breadcrumbs"],
  policy: PrivacyPolicy,
): { value: Breadcrumb | null; losses: MappingLoss[] } => {
  const { timestamp } = breadcrumb;
  const path = `breadcrumbs.${breadcrumb.name}`;

  const validation = validateDeclared(
    declared,
    breadcrumb.name,
    breadcrumb.data,
  );

  if (
    !validation.valid ||
    (validation.value !== undefined && !isRecord(validation.value))
  ) {
    return { value: null, losses: [{ path, reason: "invalid" }] };
  }

  const losses: MappingLoss[] = [];

  const name = sanitizeString(breadcrumb.name, {
    path,
    maxLength: policy.limits.stringLength,
    scrub: policy.scrub,
    losses,
  });

  // A breadcrumb the predicate names keeps its name and loses its data.
  if (policy.redact(breadcrumb.name, path)) {
    return { value: Object.freeze({ name, data: null, timestamp }), losses };
  }

  const sanitized = sanitizeValue(validation.value, path, policy);

  losses.push(...sanitized.losses);

  if (!isRecord(sanitized.value)) {
    return { value: Object.freeze({ name, data: null, timestamp }), losses };
  }

  return {
    value: Object.freeze({ name, data: sanitized.value, timestamp }),
    losses,
  };
};
