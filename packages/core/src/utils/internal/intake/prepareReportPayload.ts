import type { MappingLoss } from "src/types/MappingLoss";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import type { ReportPayload } from "src/types/internal/ReportPayload";
import type { ReportSource } from "src/types/internal/ReportSource";
import { assertUnreachable } from "src/utils/common/assertUnreachable";
import { sanitizeValue } from "src/utils/internal/privacy/sanitizeValue";
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

  const { limits } = policy;
  const sanitized = sanitizeValue(source.text, "message", {
    ...policy,
    limits: { ...limits, stringLength: limits.messageLength },
  });
  return {
    payload: {
      kind: "message",
      message: typeof sanitized.value === "string" ? sanitized.value : "",
    },
    losses: sanitized.losses,
  };
};
