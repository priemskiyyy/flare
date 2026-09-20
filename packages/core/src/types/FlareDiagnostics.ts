import type { FlareDiagnosticEvent } from "src/types/FlareDiagnosticEvent";
import type { FlareSnapshot } from "src/types/FlareSnapshot";
import type { ObservableValue } from "src/types/ObservableValue";

/**
 * Read-only view for devtools: the snapshot as an observable, and a stream of
 * events. Observing is passive: it starts no destination and creates no
 * report, and events are only assembled while someone listens. Disposal sends
 * one final notification, clears listeners, and leaves a stable snapshot.
 *
 * @example
 * ```ts
 * const stop = flare.diagnostics.subscribe(() => render(flare.diagnostics.get()));
 * ```
 */
export type FlareDiagnostics = ObservableValue<FlareSnapshot> & {
  events: {
    subscribe: (listener: (event: FlareDiagnosticEvent) => void) => () => void;
  };
};
