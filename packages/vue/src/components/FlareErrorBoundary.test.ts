import { Flare } from "@priemskiyyy/flare";
import type { Receipt } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { mount } from "@vue/test-utils";
import { afterEach, expect, test, vi } from "vitest";
import { defineComponent, h, nextTick, shallowRef } from "vue";

import { FlareErrorBoundary, FlareProvider } from "src/index";
import type { FlareErrorBoundaryProps } from "src/index";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    cleanup();
  }
});

const create = () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  flare.start();
  cleanups.push(flare.dispose);
  return { mock, flare };
};

const isBroken = shallowRef(true);
const Widget = defineComponent(() => () => {
  if (isBroken.value) {
    throw new Error("the widget could not render");
  }
  return h("p", "the widget renders");
});

type Slots = {
  default?: () => unknown;
  fallback?: (props: { error: unknown; reset: () => void }) => unknown;
};

const render = (
  flare: Flare<Record<string, never>>,
  props: FlareErrorBoundaryProps = {},
  slots: Slots = {},
  appErrorHandler: (error: unknown) => void = () => {},
) => {
  isBroken.value = true;
  const view = mount(
    defineComponent(
      () => () =>
        h(
          FlareProvider,
          { flare },
          {
            default: () =>
              h(FlareErrorBoundary, props, {
                default: () => h(Widget),
                fallback: () => h("p", "something went wrong"),
                ...slots,
              }),
          },
        ),
    ),
    { global: { config: { errorHandler: appErrorHandler } } },
  );
  cleanups.push(() => view.unmount());
  return view;
};

test("an error thrown while rendering is reported once, and the fallback is shown", async () => {
  const { mock, flare } = create();

  const view = render(flare);
  await nextTick();

  expect(view.text()).toBe("something went wrong");
  expect(mock.submissions).toHaveLength(1);
  expect(mock.submissions[0]?.report).toMatchObject({
    kind: "exception",
    exception: { name: "Error", message: "the widget could not render" },
  });
});

test("where Vue caught it travels as the vue context, beside the contexts given to the boundary", async () => {
  const { mock, flare } = create();

  render(flare, { capture: { contexts: { cart: { id: "c_1" } } } });
  await nextTick();

  expect(mock.submissions[0]?.report.contexts).toEqual({
    cart: { id: "c_1" },
    vue: { info: "render function" },
  });
});

test("capture options shape the report the boundary makes", async () => {
  const { mock, flare } = create();

  render(flare, {
    capture: {
      tags: { area: "cart" },
      level: "fatal",
      operation: "render-cart",
    },
  });
  await nextTick();

  const report = mock.submissions[0]?.report;
  expect(report?.tags).toEqual({ area: "cart" });
  expect(report?.level).toBe("fatal");
  expect(report?.operation).toBe("render-cart");
});

test("the fallback slot receives the error and a reset that renders the children again", async () => {
  const { mock, flare } = create();
  const seen: unknown[] = [];
  const view = render(
    flare,
    {},
    {
      fallback: ({ error, reset }) => {
        seen.push(error);
        return h("button", { onClick: reset }, "try again");
      },
    },
  );
  await nextTick();
  expect(seen[0]).toBeInstanceOf(Error);

  isBroken.value = false;
  await view.get("button").trigger("click");

  expect(view.text()).toBe("the widget renders");
  expect(mock.submissions).toHaveLength(1);
});

test("an onError callback is told after the report is made, with its receipt", async () => {
  const { flare } = create();
  const told: Array<{ error: unknown; receipt: Receipt }> = [];

  render(flare, { onError: (caught) => told.push(caught) });
  await nextTick();

  expect(told).toHaveLength(1);
  expect(told[0]?.error).toBeInstanceOf(Error);
  expect(await told[0]?.receipt.settled).toMatchObject({
    state: "settled",
    outcomes: { primary: { status: "submitted" } },
  });
});

test("a captured error stops at the boundary, so the application's own handler does not report it again", async () => {
  const { flare } = create();
  const appErrorHandler = vi.fn();

  render(flare, {}, {}, appErrorHandler);
  await nextTick();

  expect(appErrorHandler).not.toHaveBeenCalled();
});

test("an error thrown by the fallback itself goes to the parent and is not reported in a loop", async () => {
  const { mock, flare } = create();
  const appErrorHandler = vi.fn();

  // A component, because an error thrown by the slot function itself belongs to
  // the boundary's own render, which Vue never hands to its own capture hook.
  const BrokenFallback = defineComponent(() => () => {
    throw new Error("the fallback is broken too");
  });

  render(flare, {}, { fallback: () => h(BrokenFallback) }, appErrorHandler);
  await nextTick();

  expect(mock.submissions).toHaveLength(1);
  expect(appErrorHandler).toHaveBeenCalledTimes(1);
  expect(appErrorHandler.mock.calls[0]?.[0]).toMatchObject({
    message: "the fallback is broken too",
  });
});

test("an error in an event handler below the boundary is captured too, which is Vue's rule", async () => {
  const { mock, flare } = create();
  const Button = defineComponent(
    () => () =>
      h(
        "button",
        {
          onClick: () => {
            throw new Error("the handler failed");
          },
        },
        "press",
      ),
  );
  const view = render(flare, {}, { default: () => h(Button) });
  await nextTick();
  expect(mock.submissions).toEqual([]);

  await view.get("button").trigger("click");

  expect(mock.submissions).toHaveLength(1);
  expect(mock.submissions[0]?.report.contexts).toEqual({
    vue: { info: "native event handler" },
  });
  expect(view.text()).toBe("something went wrong");
});

test("a boundary with nothing to catch renders its children and reports nothing", async () => {
  const { mock, flare } = create();
  const view = render(flare, {}, { default: () => h("p", "all good") });
  await nextTick();

  expect(view.text()).toBe("all good");
  expect(mock.submissions).toEqual([]);
});

test("a boundary outside a provider fails with a message that names the provider", () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});

  expect(() =>
    mount(FlareErrorBoundary, { slots: { default: () => h("p") } }),
  ).toThrow("FlareErrorBoundary must be used within a FlareProvider.");
});
