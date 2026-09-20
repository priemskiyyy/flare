import type { ObservableValue } from "@priemskiyyy/flare";
import { computed, onMounted, onWatcherCleanup, shallowRef, watch } from "vue";
import type { ComputedRef, ShallowRef } from "vue";

/**
 * Mirrors a `get`/`subscribe` source into a read-only ref. Until the component
 * is mounted it reads `initial`, which is what the server rendered, so a
 * client that hydrates never disagrees with the markup it was given.
 */
export const useObservableValue = <TValue>(
  observable: () => ObservableValue<TValue>,
  initial: TValue,
  onChange?: (value: TValue) => void | Promise<unknown>,
): ComputedRef<TValue> => {
  // Annotated, because `shallowRef` answers a generic with a conditional type that reads as `any`.
  const snapshot: ShallowRef<TValue> = shallowRef(initial);

  onMounted(() => {
    watch(
      observable,
      (current) => {
        snapshot.value = current.get();
        onWatcherCleanup(
          current.subscribe(() => {
            snapshot.value = current.get();
          }),
        );

        if (typeof onChange !== "function") {
          return;
        }

        // A listener of its own, so a callback that throws cannot disturb the snapshot.
        onWatcherCleanup(current.subscribe(() => onChange(current.get())));
      },
      { immediate: true, flush: "sync" },
    );
  });

  // Read-only, and the status keeps its identity instead of being proxied.
  return computed(() => snapshot.value);
};
