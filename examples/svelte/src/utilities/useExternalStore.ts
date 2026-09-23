import type { ReadableValue } from "@priemskiyyy/flare-svelte";
import { createSubscriber } from "svelte/reactivity";

/** Svelte's counterpart of React's `useSyncExternalStore`, read through `current` as the binding's utilities are. */
export const useExternalStore = <T>(
  subscribe: (listener: () => void) => () => void,
  getSnapshot: () => T,
): ReadableValue<T> => {
  const track = createSubscriber(subscribe);

  return {
    get current() {
      track();

      return getSnapshot();
    },
  };
};
