import { Flare } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { renderToString } from "solid-js/web";
import { expect, test, vi } from "vitest";

import {
  FlareErrorBoundary,
  FlareProvider,
  useDestinationStatus,
  useFlareStatus,
} from "src/index";

const Status = () => {
  const status = useFlareStatus();
  const primary = useDestinationStatus("primary");

  return (
    <span>
      {status().state}/{primary().state}
    </span>
  );
};

test("server rendering is inert: it reads idle, subscribes to nothing, opens nothing and reports nothing", () => {
  expect(typeof window).toBe("undefined");

  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  const subscribe = vi.spyOn(flare.status, "subscribe");

  const destinationSubscribe = vi.spyOn(
    flare.destination("primary").status,
    "subscribe",
  );

  const html = renderToString(() => (
    <FlareProvider flare={flare}>
      <FlareErrorBoundary fallback={<p>fallback</p>}>
        <Status />
      </FlareErrorBoundary>
    </FlareProvider>
  ));

  expect(html).toContain("idle");
  expect(html).not.toContain("fallback");
  expect(subscribe).not.toHaveBeenCalled();
  expect(destinationSubscribe).not.toHaveBeenCalled();
  expect(mock.openings).toEqual([]);
  expect(mock.submissions).toEqual([]);
  flare.dispose();
});

test("a Flare that was started on the server still renders idle, so the client can hydrate it", () => {
  const flare = new Flare({
    destinations: { primary: createMockAdapter().adapter },
  });

  flare.start();

  const html = renderToString(() => (
    <FlareProvider flare={flare}>
      <Status />
    </FlareProvider>
  ));

  expect(html).not.toContain("started");
  expect(html).toContain("idle");
  flare.dispose();
});

test("an error thrown while rendering on the server is reported through that Flare, and the fallback is rendered", async () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  const Broken = (): never => {
    throw new Error("the server could not render this");
  };

  const html = renderToString(() => (
    <FlareProvider flare={flare}>
      <FlareErrorBoundary fallback={<p>fallback</p>}>
        <Broken />
      </FlareErrorBoundary>
    </FlareProvider>
  ));

  expect(html).toContain("fallback");
  expect(mock.submissions).toHaveLength(1);
  expect(mock.submissions[0]?.report).toMatchObject({
    exception: { message: "the server could not render this" },
  });
  flare.dispose();
});
