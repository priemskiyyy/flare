import type { MappingLoss } from "src/types/MappingLoss";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import type { ReportPayload } from "src/types/internal/ReportPayload";
import type { ReportSource } from "src/types/internal/ReportSource";
import { assertUnreachable } from "src/utils/common/assertUnreachable";
import { sanitizeString } from "src/utils/internal/privacy/sanitizeString";
import { normalizeException } from "src/utils/internal/report/normalizeException";

/** Normalizes a thrown value or message into the sanitized subject of a report. */
export const prepareReportPayload = (
  source: ReportSource,
  policy: PrivacyPolicy,
): {
  payload: ReportPayload;
  losses: readonly MappingLoss[];
} => {
  if (source.kind === "exception") {
    const normalized = normalizeException(source.thrown, policy);

    return {
      payload: { kind: "exception", exception: normalized.exception },
      losses: normalized.losses,
    };
  }

  if (source.kind !== "message") {
    return assertUnreachable(source);
  }

  if (typeof source.text !== "string") {
    return {
      payload: { kind: "message", message: "" },
      losses: [{ path: "message", reason: "invalid" }],
    };
  }

  const losses: MappingLoss[] = [];

  const message = sanitizeString(source.text, {
    path: "message",
    maxLength: policy.limits.messageLength,
    scrub: policy.scrub,
    losses,
  });

  return { payload: { kind: "message", message }, losses };
};
