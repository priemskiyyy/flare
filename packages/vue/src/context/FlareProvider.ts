import { computed, defineComponent, provide } from "vue";

import { FLARE_CONTEXT } from "src/context/FlareContext";
import type { RegisteredFlare } from "src/types/Register";

export type FlareProviderProps = {
  flare: RegisteredFlare;
};

/**
 * Publishes one Flare to the components below, and does nothing else. The
 * Flare owns its own lifetime: whoever constructed it starts it and disposes
 * it, so mounting the provider starts no destination and unmounting it shuts
 * none down, not even an SDK Flare owns.
 *
 * @example
 * ```vue
 * <FlareProvider :flare="flare">
 *   <Application />
 * </FlareProvider>
 * ```
 */
export const FlareProvider = defineComponent(
  (props: FlareProviderProps, { slots }) => {
    provide(
      FLARE_CONTEXT,
      computed(() => props.flare),
    );
    return () => slots.default?.();
  },
  { name: "FlareProvider", props: ["flare"] },
);
