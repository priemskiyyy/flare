import { useContext } from "solid-js";

import { FlareContext } from "src/context/FlareContext";

export const useFlareContext = (subject: string) => {
  const context = useContext(FlareContext);

  if (context === undefined) {
    throw new Error(`${subject} must be used within a FlareProvider.`);
  }

  return context;
};
