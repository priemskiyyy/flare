# @priemskiyyy/flare-trace

Turn selected Trace events into [Flare](../core) breadcrumbs, so an error report shows what the user did just before it. Neither library depends on the other: this package is the only place they meet.

Trace has not been released yet. The bridge is written against a small subscription interface that Flare owns, `TraceEventSource`, which Trace is expected to satisfy. Anything else with that shape works today.

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-trace
```

## Bridge some events

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

// Later, for example when the user opts out:
stop();
```

## Options

| Option   | Default    | Meaning                                                                                                           |
| -------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| `source` | required   | Anything with `subscribe(listener)` that returns its unsubscriber and delivers `{ name, properties, timestamp }`. |
| `flare`  | required   | The Flare that receives the breadcrumbs.                                                                          |
| `map`    | required   | One function per event to bridge. It returns `{ name, data? }`, or `null` to decline that event.                  |
| `now`    | `Date.now` | The clock that decides what occurred before bridging began.                                                       |

`traceBreadcrumbs` returns the function that stops it. Stopping is synchronous and idempotent, and nothing is bridged afterwards, even by a source that keeps calling.

## Behavior

- Only mapped events are bridged. An event with no entry in `map` is ignored, and there is deliberately no option to pass every event or every property through. Analytics properties are collected for a different purpose, often hold personal data, and are not error context until someone decides they are.
- Only what a mapper returns is copied. The mapper is typed by its own event, so `({ cartId }) => ...` knows what a `checkout.started` carries.
- What a mapper returns is still a breadcrumb like any other: Flare validates it against your schema, redacts it, scrubs it and bounds it before it is kept. With a typed schema, declare the breadcrumb names you map to, or Flare drops them and records the loss.
- A breadcrumb keeps the time its event occurred, not the time it was delivered.
- History is not replayed. An event that occurred before bridging began is ignored, however it arrives. Analytics libraries commonly queue events until they start and then flush them to every subscriber, and those are history.
- Identity boundaries hold. Flare refuses a breadcrumb that occurred before the current identity began, so an event tracked for one account and delivered after a switch never becomes the next account's breadcrumb. Breadcrumbs already kept are cleared by Flare when the identity changes, like all session breadcrumbs.
- A mapper that throws costs its own breadcrumb. It never breaks the source's dispatch or reaches your application.
- It is passive. Bridging starts no destination and creates no report.

## Overlap with providers that already do this

Some providers turn analytics events into crash breadcrumbs on their own, and bridging the same events through Flare shows them twice in that provider:

- Firebase Crashlytics adds Google Analytics events as breadcrumbs when Analytics is enabled in the same application. If Trace feeds Google Analytics, leave those events out of `map`, or turn breadcrumb mirroring off in `@priemskiyyy/flare-crashlytics`.
- Sentry and Bugsnag record navigation, network and user interaction breadcrumbs automatically. Do not bridge a Trace event that only restates one of those.

Bridge the events that say something the provider cannot know: the product step a user was in, not the click that got them there.

## Tests

The tests run against an in-process fake source, which can also misbehave: it can hand a new subscriber its history, and it can keep calling after it was told to stop. A typecheck-only contract file pins the typing of mappers and the acceptance of a Flare with a typed schema. No contract file pins `TraceEventSource` to a real Trace, because there is none yet. When Trace exists, add one that assigns a real Trace to that type, the way `silo-simulcast` does for a Simulcast channel.

## License

[MIT](LICENSE)
