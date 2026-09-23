import { Flare } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { FlareProvider } from "@priemskiyyy/flare-react";
import { cleanup, render } from "@testing-library/react";
import { StrictMode, createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";

import { FlareDevtools } from "src/react";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const create = () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  const tree = createElement(
    StrictMode,
    null,
    createElement(
      FlareProvider,
      { flare },
      createElement(FlareDevtools, { initialIsOpen: true }),
    ),
  );

  return { mock, flare, tree };
};

test("Strict Mode mounts one inspector, and unmounting leaves no listener behind", () => {
  const { mock, flare, tree } = create();
  const live = { count: 0 };
  const subscribe = flare.diagnostics.events.subscribe;

  vi.spyOn(flare.diagnostics.events, "subscribe").mockImplementation(
    (listener) => {
      live.count += 1;

      const stop = subscribe(listener);

      return () => {
        live.count -= 1;
        stop();
      };
    },
  );

  const view = render(tree);
  const hosts = view.container.querySelectorAll("[data-flare-devtools]");

  expect(hosts).toHaveLength(1);
  expect(
    hosts[0]?.shadowRoot?.querySelector("[aria-label='Flare devtools']"),
  ).not.toBeNull();
  expect(live.count).toBe(1);

  view.unmount();

  expect(live.count).toBe(0);
  expect(mock.sessions).toEqual([]);
  expect(mock.submissions).toEqual([]);
});

test("on the server the wrapper renders only its empty host element and observes nothing", () => {
  const { mock, flare, tree } = create();
  const subscribe = vi.spyOn(flare.diagnostics, "subscribe");

  const html = renderToString(tree);

  expect(html).toBe('<div data-flare-devtools=""></div>');
  expect(subscribe).not.toHaveBeenCalled();
  expect(mock.sessions).toEqual([]);
});
