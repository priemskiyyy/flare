import { FlareError } from "@priemskiyyy/flare";
import { useContext } from "react";

import { FlareContext } from "src/context/FlareContext";
import type { RegisteredFlare } from "src/types/Register";

/**
 * Returns the nearest provider's Flare and throws when the provider is
 * missing. Reading it starts nothing. Augment `Register` to type it.
 *
 * @example
 * ```ts
 * const flare = useFlare();
 *
 * const handleSavePress = () => save().catch(flare.capture);
 * ```
 */
export const useFlare = (): RegisteredFlare => {
  const flare = useContext(FlareContext);

  if (flare === undefined) {
    throw new FlareError({
      code: "INVALID_CONFIGURATION",
      message: "Flare hooks must be used within a FlareProvider.",
    });
  }

  return flare;
};
