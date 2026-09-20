// Typechecked, never imported: these lines fail compilation if a mapper stops
// being typed by its own event, or if a Flare with a typed schema stops being
// accepted. There is no real Trace to pin `TraceEventSource` to yet.
import { Flare } from "@priemskiyyy/flare";
import type { FlareSchema, StandardSchema } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";

import { traceBreadcrumbs } from "src/traceBreadcrumbs";
import type { TraceEventSource } from "src/types/TraceEventSource";

type Events = {
  "checkout.started": { cartId: string; total: number };
  "page.viewed": { path: string };
};

declare const source: TraceEventSource<Events>;
declare const schemaOf: <TValue>() => StandardSchema<TValue>;

const schema = {
  breadcrumbs: { checkoutStarted: schemaOf<{ cartId: string }>() },
} satisfies FlareSchema;

const untyped = new Flare({
  destinations: { primary: createMockAdapter().adapter },
});
const typed = new Flare({
  destinations: { primary: createMockAdapter().adapter },
  schema,
});

// Both an untyped Flare and one whose schema types its breadcrumbs are accepted.
export const stopUntyped: () => void = traceBreadcrumbs({
  source,
  flare: untyped,
  map: {},
});
export const stopTyped: () => void = traceBreadcrumbs({
  source,
  flare: typed,
  map: {
    // Each mapper is typed by its own event.
    "checkout.started": ({ cartId, total }) => ({
      name: "checkoutStarted",
      data: { cartId, large: total > 100 },
    }),
    "page.viewed": ({ path }) => (path === "/" ? null : { name: "pageViewed" }),
  },
});

traceBreadcrumbs({
  source,
  flare: untyped,
  map: {
    // @ts-expect-error -- "cart.emptied" is not an event of this source.
    "cart.emptied": () => ({ name: "cartEmptied" }),
  },
});

traceBreadcrumbs({
  source,
  flare: untyped,
  map: {
    // @ts-expect-error -- a page view has no cartId.
    "page.viewed": ({ cartId }) => ({ name: "pageViewed", data: { cartId } }),
  },
});

traceBreadcrumbs({
  source,
  flare: untyped,
  map: {
    // @ts-expect-error -- a mapper answers a breadcrumb or null, never the properties as they are.
    "page.viewed": (properties) => properties,
  },
});

// @ts-expect-error -- there is no way to bridge without choosing what is bridged.
traceBreadcrumbs({ source, flare: untyped });
