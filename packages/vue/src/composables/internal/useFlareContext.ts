import { inject } from "vue";

import { FLARE_CONTEXT } from "src/context/FlareContext";

export const useFlareContext = (subject: string) => {
  const context = inject(FLARE_CONTEXT, undefined);

  if (context === undefined) {
    throw new Error(`${subject} must be used within a FlareProvider.`);
  }

  return context;
};
