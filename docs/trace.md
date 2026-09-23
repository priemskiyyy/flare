---
description: "Turn selected Trace analytics events into Flare breadcrumbs, so an error report shows what the user did just before it, without leaking analytics data."
---

# Trace integration

`@priemskiyyy/flare-trace` turns the analytics events you choose into breadcrumbs. Neither library depends on the other. This package is the only place they meet.

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-trace
```

```ts
import { traceBreadcrumbs } from "@priemskiyyy/flare-trace";

const stop = traceBreadcrumbs({
  source: trace.events,
  flare,
  map: {
    "checkout.started": ({ cartId }) => ({
      name: "checkoutStarted",
      data: { cartId },
    }),
    "page.viewed": ({ path }) => {
      // Admin pages leave no trail.
      if (path.startsWith("/admin")) {
        return null;
      }

      return { name: "pageViewed", data: { path } };
    },
  },
});

stop();
```

## The rules

- **Only mapped events are bridged**, and only what the mapper returns is copied. There is deliberately no option to pass every event through. Analytics properties are collected for another purpose and often hold personal data.
- **A bridged breadcrumb is an ordinary breadcrumb.** Flare validates, redacts, scrubs and bounds it before it is kept.
- **It keeps the time the event occurred**, not the time it was delivered.
- **History is not replayed.** An event that occurred before bridging began is ignored, however late it arrives.
- **Account boundaries hold.** A breadcrumb that occurred before the current account signed in is refused.
- **A mapper that throws costs its own breadcrumb** and nothing else.

## Status of Trace

Trace has not been released. The bridge is written against a small interface that Flare owns, `TraceEventSource`: anything with a `subscribe(listener)` that returns its unsubscriber and delivers `{ name, properties, timestamp }`. Anything of that shape works today.

```ts
import type { TraceEventSource } from "@priemskiyyy/flare-trace";

type Events = { "page.viewed": { path: string } };

const listeners = new Set<
  Parameters<TraceEventSource<Events>["subscribe"]>[0]
>();

const source: TraceEventSource<Events> = {
  subscribe: (listener) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },
};
```

## Avoid double breadcrumbs

Crashlytics already adds Google Analytics events as breadcrumbs, and Sentry and Bugsnag record navigation and network breadcrumbs by themselves. Bridge the events that say something a provider cannot know, such as the product step the user was in.

The [package README](https://github.com/priemskiyyy/flare/tree/main/packages/trace#readme) is the full reference.
