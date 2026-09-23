import { Flare } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { render } from "svelte/server";
import { expect, test, vi } from "vitest";

import BoundaryHarness from "../components/BoundaryHarness.fixture.svelte";
import StatusHarness from "../utilities/StatusHarness.fixture.svelte";

test("server rendering is inert: it reads idle, subscribes to nothing, opens nothing and reports nothing", () => {
  expect(typeof window).toBe("undefined");

  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  const subscribe = vi.spyOn(flare.status, "subscribe");

  const destinationSubscribe = vi.spyOn(
    flare.destination("primary").status,
    "subscribe",
  );

  const { body } = render(StatusHarness, { props: { flare } });

  const boundary = render(BoundaryHarness, {
    props: { flare, isBroken: () => false },
  });

  expect(body).toContain("idle/idle");
  expect(boundary.body).toContain("the widget renders");
  expect(subscribe).not.toHaveBeenCalled();
  expect(destinationSubscribe).not.toHaveBeenCalled();
  expect(mock.sessions).toEqual([]);
  expect(mock.submissions).toEqual([]);
  flare.dispose();
});

test("a Flare that was started on the server still renders idle, so the client can hydrate it", () => {
  const flare = new Flare({
    destinations: { primary: createMockAdapter().adapter },
  });

  flare.start();

  const { body } = render(StatusHarness, { props: { flare } });

  expect(body).toContain("idle/idle");
  expect(body).not.toContain("started");
  flare.dispose();
});

test("on the server a boundary catches nothing: the error leaves render, and reporting it is the caller's job", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  // Rendering is lazy, so the error surfaces when the markup is read.
  expect(
    () =>
      render(BoundaryHarness, { props: { flare, isBroken: () => true } }).body,
  ).toThrow("the widget could not render");
  expect(mock.submissions).toEqual([]);
  flare.dispose();
});
