import type { FlareStatus } from "@priemskiyyy/flare";

import { useObservableValue } from "src/hooks/internal/useObservableValue";
import { useFlare } from "src/hooks/useFlare";

// Interned so the server snapshot is one reference per render.
const IDLE_FLARE_STATUS = { state: "idle" } satisfies FlareStatus;

const getServerFlareStatus = (): FlareStatus => IDLE_FLARE_STATUS;

/**
 * Observes the runtime: `idle`, `started` or `disposed`. It observes only. It
 * never starts Flare, opens a destination or creates a report. On the server
 * and the hydrating render it reads `idle`.
 *
 * @example
 * ```ts
 * const status = useFlareStatus();
 *
 * if (status.state === "idle") return null;
 * ```
 */
export const useFlareStatus = (
  onChange?: (status: FlareStatus) => void | Promise<unknown>,
): FlareStatus => {
  const flare = useFlare();

  return useObservableValue(flare.status, getServerFlareStatus, onChange);
};
