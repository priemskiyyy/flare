import { createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";

/** Solid's counterpart of React's `useSyncExternalStore`, for the example's logs and observable values. */
export const useExternalStore = <T>(
  subscribe: (listener: () => void) => () => void,
  getSnapshot: () => T,
): Accessor<T> => {
  const [value, setValue] = createSignal(getSnapshot());

  onCleanup(subscribe(() => setValue(() => getSnapshot())));

  return value;
};
