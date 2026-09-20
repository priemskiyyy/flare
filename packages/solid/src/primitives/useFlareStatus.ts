import type { FlareStatus } from "@priemskiyyy/flare";

import { useObservableValue } from "src/primitives/internal/useObservableValue";
import { useFlare } from "src/primitives/useFlare";

const IDLE_FLARE_STATUS = { state: "idle" } satisfies FlareStatus;

/**
 * Observes the runtime: `idle`, `started` or `disposed`. It observes only. It
 * never starts Flare, opens a destination or creates a report. On the server
 * and until the component is mounted it reads `idle`.
 *
 * @example
 * ```ts
 * const status = useFlareStatus();
 * ```
 */
export const useFlareStatus = (
  onChange?: (status: FlareStatus) => void | Promise<unknown>,
) => {
  const flare = useFlare();

  return useObservableValue<FlareStatus>(
    () => flare().status,
    IDLE_FLARE_STATUS,
    onChange,
  );
};
