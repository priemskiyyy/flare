import type { DestinationOutcome } from "src/types/DestinationOutcome";
import type { MappingLoss } from "src/types/MappingLoss";
import type { SubmissionEvidence } from "src/types/SubmissionEvidence";
import { isRecord } from "src/utils/common/isRecord";

const EVIDENCE = {
  "sdk-call-returned": true,
  "sdk-callback-completed": true,
  "backend-acknowledged": true,
} satisfies Record<SubmissionEvidence, true>;

const LOSS_REASONS = {
  truncated: true,
  invalid: true,
  unsupported: true,
} satisfies Record<MappingLoss["reason"], true>;

const NO_LOSSES: readonly MappingLoss[] = Object.freeze([]);

const isEvidence = (value: unknown): value is SubmissionEvidence =>
  typeof value === "string" && Object.hasOwn(EVIDENCE, value);

const isLossReason = (value: unknown): value is MappingLoss["reason"] =>
  typeof value === "string" && Object.hasOwn(LOSS_REASONS, value);

const parseEvent = (value: unknown) => {
  if (!isRecord(value)) {
    return null;
  }
  const { id } = value;
  return typeof id === "string" ? Object.freeze({ id }) : null;
};

const parseLosses = (value: unknown): readonly MappingLoss[] => {
  if (!Array.isArray(value)) {
    return NO_LOSSES;
  }

  const losses: MappingLoss[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }
    const { path, reason } = entry;
    if (typeof path !== "string" || !isLossReason(reason)) {
      continue;
    }
    losses.push(Object.freeze({ path, reason }));
  }
  return Object.freeze(losses);
};

/**
 * Reads what an adapter answered. An adapter written in plain JavaScript can
 * answer anything, and only the reasons an adapter may give are accepted:
 * the rest belong to the core.
 */
export const parseSubmissionResult = (
  result: unknown,
): DestinationOutcome | null => {
  if (!isRecord(result)) {
    return null;
  }

  const { status } = result;
  if (status === "submitted") {
    const { evidence, event, losses } = result;
    if (!isEvidence(evidence)) {
      return null;
    }
    return {
      status,
      evidence,
      event: parseEvent(event),
      losses: parseLosses(losses),
    };
  }

  if (status === "failed") {
    return { status, error: result.error };
  }

  const { reason } = result;
  if (status === "dropped") {
    return reason === "provider-filtered" ? { status, reason } : null;
  }

  if (status === "skipped") {
    if (
      reason === "unsupported-report-kind" ||
      reason === "auth-subject-mismatch" ||
      reason === "identity-mismatch"
    ) {
      return { status, reason };
    }
    return null;
  }

  if (status === "indeterminate") {
    return reason === "ambiguous" ? { status, reason } : null;
  }

  return null;
};
