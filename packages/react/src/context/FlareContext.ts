import { createContext } from "react";

import type { RegisteredFlare } from "src/types/Register";

export const FlareContext = createContext<RegisteredFlare | undefined>(
  undefined,
);
