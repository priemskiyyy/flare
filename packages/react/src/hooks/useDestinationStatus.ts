import type { DestinationStatus } from "@priemskiyyy/flare";

import { useObservableValue } from "src/hooks/internal/useObservableValue";
import { useFlare } from "src/hooks/useFlare";
import type { RegisteredDestinationName } from "src/types/Register";

// Interned so the server snapshot is one reference per render.
const IDLE_DESTINATION_STATUS = { state: "idle" } satisfies DestinationStatus;

const getServerDestinationStatus = (): DestinationStatus =>
  IDLE_DESTINATION_STATUS;

/**
 * Observes one destination: `idle`, `ready`, `failed` or `disposed`.
 * `ready` means locally usable, not that a network is reachable. It observes
 * only, and never starts the destination. On the server and the hydrating
 * render it reads `idle`.
 *
 * @example
 * ```ts
 * const sentry = useDestinationStatus("sentry");
 *
 * if (sentry.state === "failed") console.warn("Sentry did not start", sentry.error);
 * ```
 */
export const useDestinationStatus = (
  name: RegisteredDestinationName,
  onChange?: (status: DestinationStatus) => void | Promise<unknown>,
): DestinationStatus => {
  const flare = useFlare();

  // A handle is built per call, but its status is the destination's own store.
  return useObservableValue(
    flare.destination(name).status,
    getServerDestinationStatus,
    onChange,
  );
};
