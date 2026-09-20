// @vitest-environment jsdom
import { Flare } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";

import { FlareErrorBoundary } from "src/components/FlareErrorBoundary";
import { FlareProvider } from "src/context/FlareProvider";
import { useDestinationStatus } from "src/hooks/useDestinationStatus";
import { useFlareStatus } from "src/hooks/useFlareStatus";

test("SSR is inert and hydrates from the same snapshots without a mismatch", async () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  const subscribe = vi.spyOn(flare.status, "subscribe");
  const onRecoverableError = vi.fn();
  const View = () => {
    const status = useFlareStatus();
    const destination = useDestinationStatus("primary");
    return <span>{`${status.state}/${destination.state}`}</span>;
  };
  const view = (
    <FlareProvider flare={flare}>
      <FlareErrorBoundary fallback={null}>
        <View />
      </FlareErrorBoundary>
    </FlareProvider>
  );

  const html = renderToString(view);

  expect(html).toContain("idle/idle");
  expect(subscribe).not.toHaveBeenCalled();
  expect(mock.openings).toEqual([]);
  expect(mock.submissions).toEqual([]);

  // The client has already started Flare by the time it hydrates. The first
  // client render must still match the server's markup.
  flare.start();
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  let root: ReturnType<typeof hydrateRoot> | undefined;
  await act(async () => {
    root = hydrateRoot(container, view, { onRecoverableError });
    await Promise.resolve();
  });

  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(container.textContent).toBe("started/ready");

  act(() => root?.unmount());
  container.remove();
});
