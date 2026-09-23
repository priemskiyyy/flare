// @vitest-environment jsdom
import { Flare } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { FlareErrorBoundary } from "src/components/FlareErrorBoundary";
import { FlareProvider } from "src/context/FlareProvider";

beforeEach(() => {
  // React logs every error a boundary catches.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(cleanup);

const create = () => {
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    // Object identity dedupe would hide a boundary that captured twice.
    dedupe: { window: 0 },
  });

  flare.start();

  return { mock, flare };
};

const Broken = ({ message = "render failed" }: { message?: string }): never => {
  throw new Error(message);
};

test("an error thrown while rendering is reported once, and the fallback is shown", () => {
  const { mock, flare } = create();

  render(
    <FlareProvider flare={flare}>
      <FlareErrorBoundary fallback={<p>Something went wrong.</p>}>
        <Broken />
      </FlareErrorBoundary>
    </FlareProvider>,
  );

  expect(screen.getByText("Something went wrong.")).toBeDefined();
  expect(mock.submissions).toHaveLength(1);
  expect(mock.submissions[0]?.report).toMatchObject({
    kind: "exception",
    exception: { message: "render failed" },
  });
});

test("the component stack travels as the react context", () => {
  const { mock, flare } = create();

  render(
    <FlareProvider flare={flare}>
      <FlareErrorBoundary fallback={null}>
        <Broken />
      </FlareErrorBoundary>
    </FlareProvider>,
  );

  const context = mock.submissions[0]?.report.contexts.react;

  expect(Object.keys(context ?? {})).toEqual(["componentStack"]);
  expect(String(context?.componentStack)).toContain("Broken");
});

test("Strict Mode does not make the boundary report the same error twice", () => {
  const { mock, flare } = create();

  render(
    <StrictMode>
      <FlareProvider flare={flare}>
        <FlareErrorBoundary fallback={<p>Something went wrong.</p>}>
          <Broken />
        </FlareErrorBoundary>
      </FlareProvider>
    </StrictMode>,
  );

  expect(mock.submissions).toHaveLength(1);
});

test("capture options shape the report the boundary makes", () => {
  const { mock, flare } = create();

  render(
    <FlareProvider flare={flare}>
      <FlareErrorBoundary
        fallback={null}
        capture={{
          tags: { area: "checkout" },
          level: "fatal",
          operation: "render-cart",
        }}
      >
        <Broken />
      </FlareErrorBoundary>
    </FlareProvider>,
  );

  expect(mock.submissions[0]?.report).toMatchObject({
    tags: { area: "checkout" },
    level: "fatal",
    operation: "render-cart",
  });
});

test("contexts given to the boundary travel beside the react context, not instead of it", () => {
  const { mock, flare } = create();

  render(
    <FlareProvider flare={flare}>
      <FlareErrorBoundary
        fallback={null}
        capture={{ contexts: { cart: { items: 3 } } }}
      >
        <Broken />
      </FlareErrorBoundary>
    </FlareProvider>,
  );

  expect(
    Object.keys(mock.submissions[0]?.report.contexts ?? {}).sort(),
  ).toEqual(["cart", "react"]);
  expect(mock.submissions[0]?.report.contexts.cart).toEqual({ items: 3 });
});

test("a fallback function receives the error and a reset that renders the children again", () => {
  const { mock, flare } = create();

  const Flaky = () => {
    const [attempts, setAttempts] = useState(0);

    return (
      <FlareErrorBoundary
        fallback={({ error, reset }) => (
          <button
            type="button"
            onClick={() => {
              setAttempts(1);
              reset();
            }}
          >
            {error instanceof Error ? error.message : "unknown"}
          </button>
        )}
      >
        {attempts === 0 ? (
          <Broken message="first attempt" />
        ) : (
          <p>Recovered.</p>
        )}
      </FlareErrorBoundary>
    );
  };

  render(
    <FlareProvider flare={flare}>
      <Flaky />
    </FlareProvider>,
  );
  act(() => screen.getByRole("button", { name: "first attempt" }).click());

  expect(screen.getByText("Recovered.")).toBeDefined();
  expect(mock.submissions).toHaveLength(1);
});

test("an onError callback is told after the report is made, with its receipt", () => {
  const { flare } = create();
  const onError = vi.fn();

  render(
    <FlareProvider flare={flare}>
      <FlareErrorBoundary fallback={null} onError={onError}>
        <Broken />
      </FlareErrorBoundary>
    </FlareProvider>,
  );

  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError.mock.calls[0]?.[0]).toMatchObject({
    error: new Error("render failed"),
    receipt: { id: expect.any(String) },
  });
});

test("a boundary with nothing to catch renders its children and reports nothing", () => {
  const { mock, flare } = create();

  render(
    <FlareProvider flare={flare}>
      <FlareErrorBoundary fallback={<p>Something went wrong.</p>}>
        <p>All good.</p>
      </FlareErrorBoundary>
    </FlareProvider>,
  );

  expect(screen.getByText("All good.")).toBeDefined();
  expect(mock.submissions).toEqual([]);
});

test("a boundary outside a provider fails with a message that names the provider", () => {
  expect(() =>
    render(
      <FlareErrorBoundary fallback={null}>
        <p>child</p>
      </FlareErrorBoundary>,
    ),
  ).toThrow(
    expect.objectContaining({
      name: "FlareError",
      code: "INVALID_CONFIGURATION",
      message: "FlareErrorBoundary must be used within a FlareProvider.",
    }),
  );
});
