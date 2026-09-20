import type { DestinationStatus } from "@priemskiyyy/flare";
import type { RegisteredDestinationName } from "../types/Register.js";
import { useObservableValue } from "./internal/useObservableValue.svelte.js";
import { useFlare } from "./useFlare.js";

const IDLE_DESTINATION_STATUS = { state: "idle" } satisfies DestinationStatus;

/**
 * Observes one destination: `idle`, `starting`, `ready`, `unavailable`,
 * `failed` or `disposed`. `ready` means locally usable, not that a network is
 * reachable. It observes only, and never starts the destination. The name may
 * be a getter, and is followed when it changes.
 *
 * @example
 * ```ts
 * const sentry = useDestinationStatus("sentry");
 * ```
 */
export const useDestinationStatus = (
  name: RegisteredDestinationName | (() => RegisteredDestinationName),
  onChange?: (status: DestinationStatus) => void | Promise<unknown>,
) => {
  const flare = useFlare();

  return useObservableValue<DestinationStatus>(
    () =>
      flare.current.destination(typeof name === "function" ? name() : name)
        .status,
    IDLE_DESTINATION_STATUS,
    onChange,
  );
};
