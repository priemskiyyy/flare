import type {
  DestinationStatus,
  FlareStatus,
  ReceiptStatus,
} from "@priemskiyyy/flare";

import type { NetworkRequest } from "src/types/NetworkRequest";
import type { OutcomeStatus } from "src/types/OutcomeStatus";
import type { Tone } from "src/types/Tone";

export const OUTCOME_TONES: Record<OutcomeStatus, Tone> = {
  pending: "info",
  submitted: "positive",
  skipped: "neutral",
  dropped: "neutral",
  failed: "danger",
  indeterminate: "warning",
  "not-routed": "neutral",
};

export const RECEIPT_TONES: Record<ReceiptStatus["state"], Tone> = {
  pending: "info",
  settled: "positive",
  dropped: "neutral",
};

export const DESTINATION_STATUS_TONES: Record<
  DestinationStatus["state"],
  Tone
> = {
  idle: "neutral",
  ready: "positive",
  failed: "danger",
  disposed: "neutral",
};

export const FLARE_STATUS_TONES: Record<FlareStatus["state"], Tone> = {
  idle: "warning",
  started: "positive",
  disposed: "neutral",
};

export const REQUEST_TONES: Record<NetworkRequest["outcome"], Tone> = {
  accepted: "positive",
  failed: "danger",
  aborted: "warning",
};
