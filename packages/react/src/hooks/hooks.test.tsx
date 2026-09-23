// @vitest-environment jsdom
import { Flare } from "@priemskiyyy/flare";
import type { ObservableValue } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import type { PropsWithChildren } from "react";
import { afterEach, expect, test, vi } from "vitest";

import { FlareProvider } from "src/context/FlareProvider";
import { useDestinationStatus } from "src/hooks/useDestinationStatus";
import { useFlare } from "src/hooks/useFlare";
import { useFlareStatus } from "src/hooks/useFlareStatus";

afterEach(cleanup);

const create = (options: Parameters<typeof createMockAdapter>[0] = {}) => {
  const mock = createMockAdapter(options);
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  const wrapper = ({ children }: PropsWithChildren) => (
    <FlareProvider flare={flare}>{children}</FlareProvider>
  );

  return { mock, flare, wrapper };
};

// Counts listeners that are still attached, which is what a leak looks like.
const watchSubscriptions = (observable: ObservableValue<unknown>) => {
  const live = { count: 0 };
  const subscribe = observable.subscribe;

  vi.spyOn(observable, "subscribe").mockImplementation((listener) => {
    live.count += 1;

    const stop = subscribe(listener);

    return () => {
      live.count -= 1;
      stop();
    };
  });

  return live;
};

test("a hook used outside a provider fails with a message that names the provider", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  expect(() => renderHook(() => useFlare())).toThrow(
    expect.objectContaining({
      name: "FlareError",
      code: "INVALID_CONFIGURATION",
      message: "Flare hooks must be used within a FlareProvider.",
    }),
  );
});

test("useFlare returns the nearest provider's Flare", () => {
  const outer = create();
  const inner = create();

  const wrapper = ({ children }: PropsWithChildren) => (
    <FlareProvider flare={outer.flare}>
      <FlareProvider flare={inner.flare}>{children}</FlareProvider>
    </FlareProvider>
  );

  expect(renderHook(() => useFlare(), { wrapper }).result.current).toBe(
    inner.flare,
  );
});

test("observing is passive: mounting the provider and every status hook opens nothing and reports nothing", () => {
  const { mock, flare, wrapper } = create();

  renderHook(
    () => [useFlare(), useFlareStatus(), useDestinationStatus("primary")],
    { wrapper },
  );

  expect(mock.sessions).toEqual([]);
  expect(mock.submissions).toEqual([]);
  expect(flare.status.get()).toEqual({ state: "idle" });
});

test("useFlareStatus follows the runtime and rerenders once per change", () => {
  const { flare, wrapper } = create();
  let renders = 0;

  const { result } = renderHook(
    () => {
      renders += 1;

      return useFlareStatus();
    },
    { wrapper },
  );

  expect(result.current).toEqual({ state: "idle" });

  act(() => flare.start());

  expect(result.current).toEqual({ state: "started" });
  expect(renders).toBe(2);

  act(() => flare.start());

  expect(renders).toBe(2);

  act(() => flare.dispose());

  expect(result.current).toEqual({ state: "disposed" });
});

test("useDestinationStatus follows one destination from idle to ready, and to failed", () => {
  const { flare, wrapper } = create();

  const { result } = renderHook(() => useDestinationStatus("primary"), {
    wrapper,
  });

  expect(result.current).toEqual({ state: "idle" });

  act(() => flare.start());

  expect(result.current).toEqual({ state: "ready" });

  const failure = new Error("init failed");

  const failing = create({
    onOpen: () => {
      throw failure;
    },
  });

  const failed = renderHook(() => useDestinationStatus("primary"), {
    wrapper: failing.wrapper,
  });

  act(() => failing.flare.start());

  expect(failed.result.current).toEqual({ state: "failed", error: failure });
});

test("a status callback is told about changes, with the latest callback and its own listener", () => {
  const { flare, wrapper } = create();
  const first = vi.fn();
  const second = vi.fn();

  const { rerender } = renderHook(({ onChange }) => useFlareStatus(onChange), {
    wrapper,
    initialProps: { onChange: first },
  });

  rerender({ onChange: second });
  act(() => flare.start());

  expect(first).not.toHaveBeenCalled();
  expect(second.mock.calls).toEqual([[{ state: "started" }]]);
});

test("unmounting the provider never starts, stops or disposes anything", () => {
  const { mock, flare, wrapper } = create();

  flare.start();

  const view = renderHook(
    () => [useFlareStatus(), useDestinationStatus("primary")],
    {
      wrapper,
    },
  );

  view.unmount();

  expect(flare.status.get()).toEqual({ state: "started" });
  expect(flare.destination("primary").status.get()).toEqual({ state: "ready" });
  expect(mock.sessions).toHaveLength(1);
  expect(mock.sessions[0]?.disposeCount).toBe(0);
});

test("hooks stop observing after unmount", () => {
  const { flare, wrapper } = create();
  const flareStatus = watchSubscriptions(flare.status);

  const destinationStatus = watchSubscriptions(
    flare.destination("primary").status,
  );

  const view = renderHook(
    () => [useFlareStatus(vi.fn()), useDestinationStatus("primary")],
    {
      wrapper,
    },
  );

  expect(flareStatus.count).toBe(2);
  expect(destinationStatus.count).toBe(1);

  view.unmount();

  expect(flareStatus.count).toBe(0);
  expect(destinationStatus.count).toBe(0);
});

test("Strict Mode and a remount leave no listener behind, open nothing and report nothing", () => {
  const { mock, flare } = create();
  const flareStatus = watchSubscriptions(flare.status);

  const destinationStatus = watchSubscriptions(
    flare.destination("primary").status,
  );

  const View = () => {
    const status = useFlareStatus();
    const destination = useDestinationStatus("primary");

    return <span>{`${status.state}/${destination.state}`}</span>;
  };

  const tree = (
    <StrictMode>
      <FlareProvider flare={flare}>
        <View />
      </FlareProvider>
    </StrictMode>
  );

  const first = render(tree);

  expect(flareStatus.count).toBe(1);
  expect(destinationStatus.count).toBe(1);

  first.unmount();

  const second = render(tree);

  expect(second.container.textContent).toBe("idle/idle");
  expect(flareStatus.count).toBe(1);

  second.unmount();

  expect(flareStatus.count).toBe(0);
  expect(destinationStatus.count).toBe(0);
  expect(mock.sessions).toEqual([]);
  expect(mock.submissions).toEqual([]);
});
