import { Flare } from "@priemskiyyy/flare";
import type { Receipt } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, expect, test } from "vitest";

import Harness from "./BoundaryHarness.fixture.svelte";
import Orphan from "./Orphan.fixture.svelte";

const disposals: Array<() => void> = [];

afterEach(() => {
  cleanup();

  for (const dispose of disposals.splice(0).reverse()) {
    dispose();
  }
});

const create = () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();
  disposals.push(flare.dispose);

  return { mock, flare };
};

test("an error thrown while rendering is reported once, and the fallback is shown", async () => {
  const { mock, flare } = create();

  const view = render(Harness, { flare, isBroken: () => true });

  await tick();

  expect(view.getByRole("button", { name: "try again" })).toBeTruthy();
  expect(mock.submissions).toHaveLength(1);
  expect(mock.submissions[0]?.report).toMatchObject({
    kind: "exception",
    exception: { name: "Error", message: "the widget could not render" },
  });
});

test("capture options shape the report the boundary makes, contexts included", async () => {
  const { mock, flare } = create();

  render(Harness, {
    flare,
    isBroken: () => true,
    capture: {
      tags: { area: "cart" },
      level: "fatal",
      operation: "render-cart",
      contexts: { cart: { id: "c_1" } },
    },
  });
  await tick();

  const report = mock.submissions[0]?.report;

  expect(report?.tags).toEqual({ area: "cart" });
  expect(report?.level).toBe("fatal");
  expect(report?.operation).toBe("render-cart");
  expect(report?.contexts).toEqual({ cart: { id: "c_1" } });
});

test("the fallback snippet receives the error and a reset that renders the children again", async () => {
  const { mock, flare } = create();
  const state = { isBroken: true };
  const seen: unknown[] = [];

  const view = render(Harness, {
    flare,
    isBroken: () => state.isBroken,
    onFallback: (error) => seen.push(error),
  });

  await tick();

  state.isBroken = false;
  await fireEvent.click(view.getByRole("button", { name: "try again" }));

  expect(seen[0]).toBeInstanceOf(Error);
  expect(view.container.textContent).toContain("the widget renders");
  expect(mock.submissions).toHaveLength(1);
});

test("a second error after a reset is a new report", async () => {
  const { mock, flare } = create();
  const view = render(Harness, { flare, isBroken: () => true });

  await tick();

  await fireEvent.click(view.getByRole("button", { name: "try again" }));

  expect(mock.submissions).toHaveLength(2);
});

test("an onError callback is told after the report is made, with its receipt", async () => {
  const { flare } = create();
  const told: Array<{ error: unknown; receipt: Receipt }> = [];

  render(Harness, {
    flare,
    isBroken: () => true,
    onError: (caught) => told.push(caught),
  });
  await tick();

  expect(told).toHaveLength(1);
  expect(told[0]?.error).toBeInstanceOf(Error);
  expect(await told[0]?.receipt.settled).toMatchObject({
    state: "settled",
    outcomes: { primary: { status: "submitted" } },
  });
});

test("a boundary with nothing to catch renders its children and reports nothing", async () => {
  const { mock, flare } = create();

  const view = render(Harness, { flare, isBroken: () => false });

  await tick();

  expect(view.container.textContent).toContain("the widget renders");
  expect(mock.submissions).toEqual([]);
});

test("a boundary outside a provider fails with a message that names the provider", () => {
  expect(() => render(Orphan)).toThrow(
    "FlareErrorBoundary must be used within a FlareProvider.",
  );
});
