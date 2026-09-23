import type { ObservableValue } from "@priemskiyyy/flare";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import type { Accessor } from "solid-js";

/**
 * Mirrors a `get`/`subscribe` source into an accessor. Until the component is
 * mounted it reads `initial`, which is what the server rendered. Solid claims
 * server markup as it is while hydrating, so a different first value would
 * stay on screen until the next change.
 */
export const useObservableValue = <TValue>(
  observable: Accessor<ObservableValue<TValue>>,
  initial: TValue,
  onChange?: (value: TValue) => void | Promise<unknown>,
): Accessor<TValue> => {
  const [snapshot, setSnapshot] = createSignal(initial);

  onMount(() => {
    createEffect(() => {
      const current = observable();

      setSnapshot(() => current.get());
      onCleanup(current.subscribe(() => setSnapshot(() => current.get())));

      if (typeof onChange !== "function") {
        return;
      }

      // A listener of its own, so a callback that throws cannot disturb the snapshot.
      onCleanup(current.subscribe(() => onChange(current.get())));
    });
  });

  return snapshot;
};
