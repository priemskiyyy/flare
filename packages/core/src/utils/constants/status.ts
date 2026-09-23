import type { DestinationStatus } from "src/types/DestinationStatus";
import type { FlareStatus } from "src/types/FlareStatus";

// Interned, because observers compare statuses by identity.
export const IDLE_FLARE_STATUS = Object.freeze({
  state: "idle",
}) satisfies FlareStatus;

export const STARTED_FLARE_STATUS = Object.freeze({
  state: "started",
}) satisfies FlareStatus;

export const DISPOSED_FLARE_STATUS = Object.freeze({
  state: "disposed",
}) satisfies FlareStatus;

export const IDLE_DESTINATION_STATUS = Object.freeze({
  state: "idle",
}) satisfies DestinationStatus;

export const READY_DESTINATION_STATUS = Object.freeze({
  state: "ready",
}) satisfies DestinationStatus;

export const DISPOSED_DESTINATION_STATUS = Object.freeze({
  state: "disposed",
}) satisfies DestinationStatus;
