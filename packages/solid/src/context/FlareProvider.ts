import { createComponent, createMemo } from "solid-js";
import type { ParentProps } from "solid-js";

import { FlareContext } from "src/context/FlareContext";
import type { RegisteredFlare } from "src/types/Register";

export type FlareProviderProps = ParentProps<{
  flare: RegisteredFlare;
}>;

/**
 * Publishes one Flare to the components below, and does nothing else. The
 * Flare owns its own lifetime: whoever constructed it starts it and disposes
 * it, so mounting the provider starts no destination and unmounting it shuts
 * none down, not even an SDK Flare owns.
 *
 * @example
 * ```tsx
 * <FlareProvider flare={flare}>
 *   <Application />
 * </FlareProvider>
 * ```
 */
export const FlareProvider = (props: FlareProviderProps) =>
  createComponent(FlareContext.Provider, {
    value: createMemo(() => props.flare),
    get children() {
      return props.children;
    },
  });
