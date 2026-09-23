import type { PropsWithChildren } from "react";

import { FlareContext } from "src/context/FlareContext";
import type { RegisteredFlare } from "src/types/Register";

export type FlareProviderProps = PropsWithChildren<{
  flare: RegisteredFlare;
}>;

/**
 * Publishes one Flare to the tree below, and does nothing else. The Flare
 * owns its own lifetime: whoever constructed it starts it and disposes it, so
 * mounting the provider starts no destination and unmounting it shuts none
 * down.
 *
 * @example
 * ```tsx
 * const flare = new Flare({ destinations: { sentry: sentry({ sdk: Sentry }) } });
 * flare.start();
 *
 * <FlareProvider flare={flare}>
 *   <Application />
 * </FlareProvider>
 * ```
 */
export const FlareProvider = ({ flare, children }: FlareProviderProps) => (
  <FlareContext.Provider value={flare}>{children}</FlareContext.Provider>
);
