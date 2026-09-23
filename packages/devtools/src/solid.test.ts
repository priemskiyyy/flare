import { Flare } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { FlareProvider } from "@priemskiyyy/flare-solid";
import { cleanup, render } from "@solidjs/testing-library";
import { createComponent, createSignal } from "solid-js";
import { afterEach, expect, test, vi } from "vitest";

import { FlareDevtools } from "src/solid";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const create = () => {
  const mock = createMockAdapter({ name: "mocked" });
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  return { mock, flare };
};

test("the Solid wrapper mounts the inspector for the provider's Flare, follows another, and removes it on cleanup", () => {
  const first = create();
  const second = create();
  const subscribe = vi.spyOn(second.flare.diagnostics, "subscribe");
  const [flare, setFlare] = createSignal(first.flare);

  const { container, unmount } = render(() =>
    createComponent(FlareProvider, {
      get flare() {
        return flare();
      },
      get children() {
        return createComponent(FlareDevtools, { initialIsOpen: true });
      },
    }),
  );

  const host = container.querySelector("[data-flare-devtools]");

  expect(host?.shadowRoot?.textContent).toContain("All destinations");
  expect(first.mock.sessions).toEqual([]);

  setFlare(() => second.flare);
  expect(subscribe).toHaveBeenCalled();

  unmount();
  expect(host?.shadowRoot?.childElementCount).toBe(0);
});
