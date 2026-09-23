import { Flare } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, expect, test, vi } from "vitest";

import Fixture from "src/svelte.fixture.svelte";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const create = () => {
  const mock = createMockAdapter({ name: "mocked" });
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  return { mock, flare };
};

test("the Svelte attachment mounts the inspector for the provider's Flare, follows another, and removes it on unmount", async () => {
  const first = create();
  const second = create();
  const subscribe = vi.spyOn(second.flare.diagnostics, "subscribe");
  const view = render(Fixture, { flare: first.flare });

  await tick();

  const host = view.container.querySelector("div div");

  expect(host?.shadowRoot?.textContent).toContain("All destinations");
  expect(first.mock.sessions).toEqual([]);

  await view.rerender({ flare: second.flare });
  await tick();
  expect(subscribe).toHaveBeenCalled();
  expect(host?.shadowRoot?.textContent).toContain("All destinations");

  view.unmount();
  expect(host?.shadowRoot?.childElementCount).toBe(0);
});
