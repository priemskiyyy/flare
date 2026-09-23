import type { ObservableValue } from "@priemskiyyy/flare";
import type { ReadableValue } from "../../types/ReadableValue.js";

/**
 * Mirrors a `get`/`subscribe` source into a value read through `current`.
 * Effects do not run on the server and run after mount on the client, so until
 * then it reads `initial`, which is what the server rendered, and a client
 * that hydrates never disagrees with the markup it was given.
 */
export const useObservableValue = <TValue>(
  observable: () => ObservableValue<TValue>,
  initial: TValue,
  onChange?: (value: TValue) => void | Promise<unknown>,
): ReadableValue<TValue> => {
  // Raw, so the status keeps its identity instead of being proxied.
  let snapshot = $state.raw(initial);

  $effect(() => {
    const current = observable();

    snapshot = current.get();

    return current.subscribe(() => {
      snapshot = current.get();
    });
  });

  $effect(() => {
    if (typeof onChange !== "function") {
      return;
    }

    // A listener of its own, so a callback that throws cannot disturb the snapshot.
    const current = observable();

    return current.subscribe(() => onChange(current.get()));
  });

  return {
    get current() {
      return snapshot;
    },
  };
};
