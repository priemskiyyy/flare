import type {
  DestinationStatus,
  FlareStatus,
  ReceiptStatus,
} from "@priemskiyyy/flare";

import type { NetworkRequest } from "src/types/NetworkRequest";
import type { OutcomeStatus } from "src/types/OutcomeStatus";

export const OUTCOME_LABELS: Record<OutcomeStatus, string> = {
  pending: "Sending",
  submitted: "Submitted",
  skipped: "Skipped",
  dropped: "Dropped",
  failed: "Failed",
  indeterminate: "Unconfirmed",
  "not-routed": "Not routed",
};

export const RECEIPT_LABELS: Record<ReceiptStatus["state"], string> = {
  pending: "Sending",
  settled: "Settled",
  dropped: "Not sent",
};

export const DESTINATION_STATUS_LABELS: Record<
  DestinationStatus["state"],
  string
> = {
  idle: "Waiting for start",
  ready: "Ready",
  failed: "Start failed",
  disposed: "Disposed",
};

export const FLARE_STATUS_LABELS: Record<FlareStatus["state"], string> = {
  idle: "Not started",
  started: "Started",
  disposed: "Disposed",
};

export const REQUEST_LABELS: Record<NetworkRequest["outcome"], string> = {
  accepted: "202",
  failed: "503",
  aborted: "Aborted",
};

/** What each answer means, for the legend under the receipts. */
export const OUTCOME_MEANINGS: Record<
  Exclude<OutcomeStatus, "pending">,
  string
> = {
  submitted: "Handed over, as far as Flare can see.",
  skipped: "Never tried, because it could not have gone there correctly.",
  dropped: "Discarded before it was sent, for a known reason.",
  failed: "Tried, and it definitely failed.",
  indeterminate: "Tried, but whether it arrived cannot be known.",
  "not-routed": "Routing sent this report elsewhere.",
};

export const OUTCOME_ORDER: Exclude<OutcomeStatus, "pending">[] = [
  "submitted",
  "skipped",
  "dropped",
  "failed",
  "indeterminate",
  "not-routed",
];
