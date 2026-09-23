import { Flare } from "@priemskiyyy/flare";
import type { Receipt } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import type { JSX } from "solid-js";
import { afterEach, expect, test } from "vitest";

import { FlareErrorBoundary, FlareProvider } from "src/index";
import type { FlareErrorBoundaryProps } from "src/index";

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

const [isBroken, setIsBroken] = createSignal(true);

const Widget = () => {
  if (isBroken()) {
    throw new Error("the widget could not render");
  }

  return <p>the widget renders</p>;
};

const renderBoundary = (
  flare: ReturnType<typeof create>["flare"],
  props: Partial<FlareErrorBoundaryProps> = {},
  children: () => JSX.Element = () => <Widget />,
) => {
  setIsBroken(true);

  return render(() => (
    <FlareProvider flare={flare}>
      <FlareErrorBoundary fallback={<p>something went wrong</p>} {...props}>
        {children()}
      </FlareErrorBoundary>
    </FlareProvider>
  ));
};

test("an error thrown while rendering is reported once, and the fallback is shown", () => {
  const { mock, flare } = create();

  const view = renderBoundary(flare);

  expect(view.container.textContent).toBe("something went wrong");
  expect(mock.submissions).toHaveLength(1);
  expect(mock.submissions[0]?.report).toMatchObject({
    kind: "exception",
    exception: { name: "Error", message: "the widget could not render" },
  });
});

test("capture options shape the report the boundary makes, contexts included", () => {
  const { mock, flare } = create();

  renderBoundary(flare, {
    capture: {
      tags: { area: "cart" },
      level: "fatal",
      operation: "render-cart",
      contexts: { cart: { id: "c_1" } },
    },
  });

  const report = mock.submissions[0]?.report;

  expect(report?.tags).toEqual({ area: "cart" });
  expect(report?.level).toBe("fatal");
  expect(report?.operation).toBe("render-cart");
  expect(report?.contexts).toEqual({ cart: { id: "c_1" } });
});

test("a fallback function receives the error and a reset that renders the children again", () => {
  const { mock, flare } = create();
  const seen: unknown[] = [];

  const view = renderBoundary(flare, {
    fallback: ({ error, reset }) => {
      seen.push(error);

      return (
        <button type="button" onClick={reset}>
          try again
        </button>
      );
    },
  });

  expect(seen[0]).toBeInstanceOf(Error);

  setIsBroken(false);
  fireEvent.click(view.getByRole("button", { name: "try again" }));

  expect(view.container.textContent).toBe("the widget renders");
  expect(mock.submissions).toHaveLength(1);
});

test("a second error after a reset is a new report", () => {
  const { mock, flare } = create();

  const view = renderBoundary(flare, {
    fallback: ({ reset }) => (
      <button type="button" onClick={reset}>
        try again
      </button>
    ),
  });

  fireEvent.click(view.getByRole("button", { name: "try again" }));

  expect(mock.submissions).toHaveLength(2);
});

test("an onError callback is told after the report is made, with its receipt", async () => {
  const { flare } = create();
  const told: Array<{ error: unknown; receipt: Receipt }> = [];

  renderBoundary(flare, { onError: (caught) => told.push(caught) });

  expect(told).toHaveLength(1);
  expect(told[0]?.error).toBeInstanceOf(Error);
  expect(await told[0]?.receipt.settled).toMatchObject({
    state: "settled",
    outcomes: { primary: { status: "submitted" } },
  });
});

test("reporting reads no signal, so a later session change does not make the boundary report again", () => {
  const { mock, flare } = create();

  renderBoundary(flare);

  flare.user({ id: "ada" });
  flare.tag("plan", "pro");

  expect(mock.submissions).toHaveLength(1);
});

test("a boundary with nothing to catch renders its children and reports nothing", () => {
  const { mock, flare } = create();

  const view = renderBoundary(flare, {}, () => <p>all good</p>);

  expect(view.container.textContent).toBe("all good");
  expect(mock.submissions).toEqual([]);
});

test("a boundary outside a provider fails with a message that names the provider", () => {
  expect(() =>
    render(() => (
      <FlareErrorBoundary fallback={<p>fallback</p>}>
        <p>child</p>
      </FlareErrorBoundary>
    )),
  ).toThrow("FlareErrorBoundary must be used within a FlareProvider.");
});
