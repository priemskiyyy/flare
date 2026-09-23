import { onScopeDispose, shallowRef } from "vue";

/** Vue's counterpart of React's `useSyncExternalStore`: a ref that follows the store while the component lives. */
export const useExternalStore = <T>(
  subscribe: (listener: () => void) => () => void,
  getSnapshot: () => T,
) => {
  const value = shallowRef(getSnapshot());

  onScopeDispose(
    subscribe(() => {
      value.value = getSnapshot();
    }),
  );

  return value;
};
