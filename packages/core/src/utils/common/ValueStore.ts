import type { ObservableValue } from "src/types/ObservableValue";
import { isolate } from "src/utils/common/errors";

export class ValueStore<TValue> implements ObservableValue<TValue> {
  #snapshot;
  #listeners = new Set<() => void>();

  constructor(initialValue: TValue) {
    this.#snapshot = { value: initialValue };
  }

  get = () => this.#snapshot.value;

  set = (nextValue: TValue) => {
    if (Object.is(nextValue, this.#snapshot.value)) {
      return;
    }

    const snapshot = { value: nextValue };
    this.#snapshot = snapshot;
    for (const listener of [...this.#listeners]) {
      // A nested update has already notified listeners of the latest snapshot.
      if (snapshot !== this.#snapshot) {
        return;
      }

      if (!this.#listeners.has(listener)) {
        continue;
      }

      isolate(listener);
    }
  };

  subscribe = (notify: () => void) => {
    // Each subscription owns its slot, even when callers reuse a callback.
    const listener = () => notify();
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  };
}
