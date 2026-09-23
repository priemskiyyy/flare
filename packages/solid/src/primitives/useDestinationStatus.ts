import type { DestinationStatus } from "@priemskiyyy/flare";
import type { Accessor } from "solid-js";

import { useObservableValue } from "src/primitives/internal/useObservableValue";
import { useFlare } from "src/primitives/useFlare";
import type { RegisteredDestinationName } from "src/types/Register";

const IDLE_DESTINATION_STATUS = { state: "idle" } satisfies DestinationStatus;

/**
 * Observes one destination: `idle`, `ready`, `failed` or `disposed`.
 * `ready` means locally usable, not that a network is reachable. It observes
 * only, and never starts the destination. The name may be an accessor, and is
 * followed when it changes.
 *
 * @example
 * ```ts
 * const sentry = useDestinationStatus("sentry");
 * ```
 */
export const useDestinationStatus = (
  name: RegisteredDestinationName | Accessor<RegisteredDestinationName>,
  onChange?: (status: DestinationStatus) => void | Promise<unknown>,
) => {
  const flare = useFlare();

  // Read inside the tracked source, so an accessor is followed as it changes.
  const readName = () => {
    if (typeof name === "function") {
      return name();
    }

    return name;
  };

  return useObservableValue<DestinationStatus>(
    () => flare().destination(readName()).status,
    IDLE_DESTINATION_STATUS,
    onChange,
  );
};
