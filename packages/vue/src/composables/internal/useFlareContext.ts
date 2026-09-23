import { FlareError } from "@priemskiyyy/flare";
import { inject } from "vue";

import { FLARE_CONTEXT } from "src/context/FlareContext";

export const useFlareContext = (subject: string) => {
  const context = inject(FLARE_CONTEXT, undefined);

  if (context === undefined) {
    throw new FlareError({
      code: "INVALID_CONFIGURATION",
      message: `${subject} must be used within a FlareProvider.`,
    });
  }

  return context;
};
