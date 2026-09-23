import type { ValueStore } from "examples/shared/ledger/types/ValueStore";

export const createValueStore = <T>(initial: T): ValueStore<T> => {
  const listeners = new Set<() => void>();
  let value = initial;

  return {
    get: () => value,
    set: (next) => {
      value = next;

      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};
