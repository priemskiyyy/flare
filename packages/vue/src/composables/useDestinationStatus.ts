import type { DestinationStatus } from "@priemskiyyy/flare";
import { toValue } from "vue";
import type { MaybeRefOrGetter } from "vue";

import { useObservableValue } from "src/composables/internal/useObservableValue";
import { useFlare } from "src/composables/useFlare";
import type { RegisteredDestinationName } from "src/types/Register";

const IDLE_DESTINATION_STATUS = { state: "idle" } satisfies DestinationStatus;

/**
 * Observes one destination: `idle`, `ready`, `failed` or `disposed`.
 * `ready` means locally usable, not that a network is reachable. It observes
 * only, and never starts the destination. The name may be a ref or a getter,
 * and is followed when it changes.
 *
 * @example
 * ```ts
 * const sentry = useDestinationStatus("sentry");
 * ```
 */
export const useDestinationStatus = (
  name: MaybeRefOrGetter<RegisteredDestinationName>,
  onChange?: (status: DestinationStatus) => void | Promise<unknown>,
) => {
  const flare = useFlare();

  return useObservableValue<DestinationStatus>(
    () => flare.value.destination(toValue(name)).status,
    IDLE_DESTINATION_STATUS,
    onChange,
  );
};
