import type { ComputedRef, InjectionKey } from "vue";

import type { RegisteredFlare } from "src/types/Register";

export const FLARE_CONTEXT: InjectionKey<ComputedRef<RegisteredFlare>> =
  Symbol("flare");
