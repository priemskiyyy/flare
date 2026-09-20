import type {
  DestinationOutcome,
  SubmissionEvidence,
} from "@priemskiyyy/flare";

const LABELS = {
  submitted: "Submitted",
  dropped: "Dropped",
  skipped: "Skipped",
  failed: "Failed",
  indeterminate: "Unconfirmed",
} satisfies Record<DestinationOutcome["status"], string>;

const EVIDENCE = {
  "sdk-call-returned": "SDK call returned",
  "sdk-callback-completed": "SDK callback completed",
  "backend-acknowledged": "Backend acknowledged",
} satisfies Record<SubmissionEvidence, string>;

export const formatOutcome = (outcome: DestinationOutcome | null) => {
  if (outcome === null) {
    return { label: "Pending", detail: "Waiting for an answer" };
  }
  if (outcome.status === "submitted") {
    return {
      label: LABELS[outcome.status],
      detail: EVIDENCE[outcome.evidence],
    };
  }
  if (outcome.status === "failed") {
    return {
      label: LABELS[outcome.status],
      detail: "The adapter returned an error",
    };
  }
  return { label: LABELS[outcome.status], detail: outcome.reason };
};
