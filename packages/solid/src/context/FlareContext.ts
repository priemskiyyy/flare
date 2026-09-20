import { createContext } from "solid-js";
import type { Accessor } from "solid-js";

import type { RegisteredFlare } from "src/types/Register";

export const FlareContext = createContext<Accessor<RegisteredFlare>>();
