// @vitest-environment jsdom
import type { ObservableValue } from "@priemskiyyy/flare";
import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { useObservableValue } from "src/hooks/internal/useObservableValue";

const createStore = (initial: number) => {
  let value = initial;
  const listeners = new Set<() => void>();

  const store: ObservableValue<number> = {
    get: () => value,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    store,
    listeners,
    set: (next: number) => {
      value = next;

      for (const listener of [...listeners]) {
        listener();
      }
    },
  };
};

test("the optional callback adds a listener only while present and reads the latest callback", () => {
  const { store, listeners, set } = createStore(1);
  const first = vi.fn();
  const second = vi.fn();

  const { result, rerender } = renderHook(
    ({ onChange }: { onChange?: (value: number) => void }) =>
      useObservableValue(store, () => 0, onChange),
    { initialProps: {} },
  );

  expect(result.current).toBe(1);
  expect(listeners.size).toBe(1);

  rerender({ onChange: first });

  expect(listeners.size).toBe(2);

  rerender({ onChange: second });
  act(() => set(2));

  expect(result.current).toBe(2);
  expect(first).not.toHaveBeenCalled();
  expect(second.mock.calls).toEqual([[2]]);
  expect(listeners.size).toBe(2);

  rerender({});

  expect(listeners.size).toBe(1);
});
