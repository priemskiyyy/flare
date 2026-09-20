import type { TraceEvent } from "src/types/TraceEvent";
import type { TraceEventSource } from "src/types/TraceEventSource";

/**
 * An event source for the tests, standing in for Trace until it exists. It
 * counts live listeners, and it can misbehave the way an analytics SDK does
 * when it flushes what was queued before it started: by handing a new
 * subscriber its history.
 */
export const fakeTraceSource = <TEvents extends Record<string, unknown>>({
  history = [],
  ignoresUnsubscribe = false,
}: {
  history?: Array<TraceEvent<TEvents>>;
  /** Keeps calling a listener after it unsubscribed, like a source with a late callback. */
  ignoresUnsubscribe?: boolean;
} = {}) => {
  const listeners = new Set<(event: TraceEvent<TEvents>) => void>();

  const source: TraceEventSource<TEvents> = {
    subscribe: (listener) => {
      listeners.add(listener);
      for (const event of history) {
        listener(event);
      }
      return () => {
        if (ignoresUnsubscribe) {
          return;
        }
        listeners.delete(listener);
      };
    },
  };

  return {
    source,
    live: () => listeners.size,
    emit: (event: TraceEvent<TEvents>) => {
      for (const listener of [...listeners]) {
        listener(event);
      }
    },
  };
};
