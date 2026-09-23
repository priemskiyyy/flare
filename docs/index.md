---
description: "Flare is provider-independent error reporting for TypeScript: one API over Sentry, Bugsnag, Crashlytics, PostHog, Datadog, OpenTelemetry, your own backend and the console."
---

# What Flare is

Flare is an error reporting library for web and React Native applications. You report errors through one small API, and deployment configuration decides which providers receive them.

```ts
import { Flare } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";

const flare = new Flare({
  destinations: { console: console() },
});

flare.start();
flare.user({ id: "user_42" });

try {
  await save();
} catch (error) {
  flare.capture(error, { tags: { area: "editor" } });
}
```

Renaming `captureException` would not be worth a library. What Flare owns is everything around the call:

- **Isolation.** What one report carries can never reach another report, another account or a provider's global state.
- **Account boundaries.** Changing the user starts a new identity. Breadcrumbs, tags and contexts of the previous account are cleared, and an operation that outlives the switch cannot attribute its error to the new account.
- **Privacy.** Redaction runs before anything is kept, buffered, observed or sent. A redactor or scrubber that fails drops the data instead of sending it.
- **Routing.** Destinations have names, names are typed, and one report can go to several providers without one failure affecting another.
- **Honest receipts.** Every report answers what happened at each destination, and on what evidence.

## The guarantee, and where it ends

Flare guarantees how a report is constructed, isolated, sanitized, routed and handed to a destination. It does not claim that a provider stored, processed, grouped or displayed a report, unless that destination gives evidence for that exact boundary. An event id from an SDK proves that the call returned, and the receipt says exactly that.

## What Flare is not

Flare does not replace native crash detection, source map or symbol upload, grouping, crash-free metrics, tracing, session replay or dashboards. Your provider keeps doing all of that. Flare is also not a logging library: breadcrumbs are error-relevant history, and there is no `debug` level and no log stream.

## Where to go next

- [Getting started](getting-started.md) builds a working setup in a few minutes.
- [The mental model](mental-model.md) explains the path a report takes.
- [Choose an adapter](adapters.md) compares what each provider can honestly do.
- [The example application](examples.md) shows every report's journey inside one page.
