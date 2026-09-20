import { Flare } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";
import { expect, test, vi } from "vitest";
import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";

import {
  FlareErrorBoundary,
  FlareProvider,
  useDestinationStatus,
  useFlareStatus,
} from "src/index";

test("server rendering is inert: it reads idle, subscribes to nothing, opens nothing and reports nothing", async () => {
  expect(typeof window).toBe("undefined");
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  const subscribe = vi.spyOn(flare.status, "subscribe");
  const destinationSubscribe = vi.spyOn(
    flare.destination("primary").status,
    "subscribe",
  );
  const Status = defineComponent(() => {
    const status = useFlareStatus();
    const primary = useDestinationStatus("primary");
    return () => h("span", `${status.value.state}/${primary.value.state}`);
  });
  const app = createSSRApp(() =>
    h(FlareProvider, { flare }, () =>
      h(FlareErrorBoundary, null, {
        default: () => h(Status),
        fallback: () => h("p", "fallback"),
      }),
    ),
  );

  expect(await renderToString(app)).toContain("idle/idle");
  expect(subscribe).not.toHaveBeenCalled();
  expect(destinationSubscribe).not.toHaveBeenCalled();
  expect(mock.openings).toEqual([]);
  expect(mock.submissions).toEqual([]);
  flare.dispose();
});

test("a Flare that was started on the server still renders idle, so the client can hydrate it", async () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  flare.start();
  const Status = defineComponent(() => {
    const status = useFlareStatus();
    return () => h("span", status.value.state);
  });

  const html = await renderToString(
    createSSRApp(() => h(FlareProvider, { flare }, () => h(Status))),
  );

  expect(html).toContain("<span>idle</span>");
  flare.dispose();
});

test("an error thrown while rendering on the server is reported through that Flare, and nothing is rendered in its place", async () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });
  flare.start();
  const appErrorHandler = vi.fn();
  const Broken = defineComponent(() => () => {
    throw new Error("the server could not render this");
  });
  const app = createSSRApp(() =>
    h(FlareProvider, { flare }, () =>
      h(FlareErrorBoundary, null, {
        default: () => h(Broken),
        fallback: () => h("p", "fallback"),
      }),
    ),
  );
  app.config.errorHandler = appErrorHandler;

  const html = await renderToString(app);

  // Server rendering is one pass, so the fallback never gets its turn.
  expect(html).not.toContain("fallback");
  expect(appErrorHandler).not.toHaveBeenCalled();
  expect(mock.submissions).toHaveLength(1);
  expect(mock.submissions[0]?.report).toMatchObject({
    exception: { message: "the server could not render this" },
    contexts: { vue: { info: "render function" } },
  });
  flare.dispose();
});
