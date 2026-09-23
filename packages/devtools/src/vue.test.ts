import { Flare } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { FlareProvider } from "@priemskiyyy/flare-vue";
import { mount } from "@vue/test-utils";
import { afterEach, expect, test, vi } from "vitest";
import { defineComponent, h, nextTick, shallowRef } from "vue";
import { renderToString } from "vue/server-renderer";

import { FlareDevtools } from "src/vue";

afterEach(() => {
  localStorage.clear();
});

const create = () => {
  const mock = createMockAdapter({ name: "mocked" });
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  return { mock, flare };
};

const Application = (flare: { value: Flare<Record<string, never>> }) =>
  defineComponent(
    () => () =>
      h(
        FlareProvider,
        { flare: flare.value },
        { default: () => h(FlareDevtools, { initialIsOpen: true }) },
      ),
  );

test("the Vue wrapper mounts the inspector for the provider's Flare, follows another, and removes it on unmount", async () => {
  const first = create();
  const second = create();
  const current = shallowRef(first.flare);
  const subscribe = vi.spyOn(second.flare.diagnostics, "subscribe");
  const wrapper = mount(Application(current));

  await nextTick();

  const host = wrapper.find("[data-flare-devtools]").element;

  expect(host.shadowRoot?.textContent).toContain("All destinations");
  expect(first.mock.sessions).toEqual([]);

  current.value = second.flare;
  await nextTick();
  expect(subscribe).toHaveBeenCalled();

  wrapper.unmount();
  expect(host.shadowRoot?.childElementCount).toBe(0);
});

test("server rendering emits only the host element and observes nothing", async () => {
  const { mock, flare } = create();
  const subscribe = vi.spyOn(flare.diagnostics, "subscribe");

  const html = await renderToString(h(Application({ value: flare })));

  expect(html).toMatch(/<div data-flare-devtools(="")?><\/div>/);
  expect(subscribe).not.toHaveBeenCalled();
  expect(mock.sessions).toEqual([]);
});
