import { FlareError } from "@priemskiyyy/flare";
import { getContext } from "svelte";
import { FLARE_CONTEXT } from "../../context/FlareContext.js";
import type { FlareContextValue } from "../../context/FlareContext.js";

export const useFlareContext = (subject: string) => {
  const context = getContext<FlareContextValue | undefined>(FLARE_CONTEXT);

  if (context === undefined) {
    throw new FlareError({
      code: "INVALID_CONFIGURATION",
      message: `${subject} must be used within a FlareProvider.`,
    });
  }

  return context;
};
