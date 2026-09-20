import type { TraceEvent } from "src/types/TraceEvent";

/**
 * The subscription contract the bridge accepts. Flare owns this type: Trace
 * has not been written yet, and is expected to satisfy it when it is. Until
 * then no contract file pins it to a real library, and the day Trace exists
 * one should be added beside this type, assigning a real Trace to it.
 *
 * `subscribe` returns its own unsubscriber, and should not replay what
 * happened before the subscription. The bridge does not rely on that.
 *
 * @example
 * ```ts
 * const source: TraceEventSource<Events> = trace.events;
 * ```
 */
export type TraceEventSource<
  TEvents extends Record<string, unknown> = Record<string, unknown>,
> = {
  subscribe: (listener: (event: TraceEvent<TEvents>) => void) => () => void;
};
