import { Flare } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { afterEach, expect, test, vi } from "vitest";
import { createSSRApp, defineComponent, h, nextTick } from "vue";
import { renderToString } from "vue/server-renderer";

import { FlareProvider, useFlareStatus } from "src/index";

afterEach(() => {
  document.body.replaceChildren();
});

test("markup rendered on the server hydrates without a mismatch, then shows the real status", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  const flare = new Flare({
    destinations: { primary: createMockAdapter().adapter },
  });

  // The client started Flare before hydrating, which is the normal order.
  flare.start();

  const Status = defineComponent(() => {
    const status = useFlareStatus();

    return () => h("span", status.value.state);
  });

  const createApp = () =>
    createSSRApp(() => h(FlareProvider, { flare }, () => h(Status)));

  const container = document.body.appendChild(document.createElement("div"));

  container.innerHTML = await renderToString(createApp());

  const app = createApp();

  app.mount(container);
  await nextTick();

  expect(warn).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  expect(container.textContent).toBe("started");
  app.unmount();
  flare.dispose();
});
