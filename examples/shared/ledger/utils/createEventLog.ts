import type { EventLog } from "examples/shared/ledger/types/EventLog";

/** A bounded, newest-first log that React reads with `useSyncExternalStore`. */
export const createEventLog = <T>(length: number) => {
  const listeners = new Set<() => void>();
  let entries: T[] = [];

  const publish = (next: T[]) => {
    entries = next;

    for (const listener of listeners) {
      listener();
    }
  };

  const log: EventLog<T> = {
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => entries,
    clear: () => {
      publish([]);
    },
  };

  return {
    log,
    add: (entry: T) => {
      publish([entry, ...entries].slice(0, length));
    },
  };
};
