---
description: "Reach the provider SDK behind a Flare destination for features Flare does not wrap, and understand which guarantees stop applying when you do."
---

# Native provider access

Flare wraps error reporting and nothing else. For everything else a provider offers, such as feature flags, user feedback dialogs, session replay or performance spans, use the SDK. `destination()` gives it to you, typed as the SDK you passed in.

```ts
const handle = flare.destination("sentry");

handle.status.get(); // { state: "ready" }
handle.native?.setTag("experiment", "b"); // the Sentry SDK itself
```

`native` is `null` until the destination is ready, and again after it is disposed. Reading it is passive: it starts nothing and reports nothing.

| Destination          | `native` is                                 |
| -------------------- | ------------------------------------------- |
| Sentry               | the SDK namespace you passed                |
| Bugsnag              | the Bugsnag API you passed                  |
| Crashlytics          | the instance returned by `getCrashlytics()` |
| PostHog              | the posthog-js instance you passed          |
| PostHog React Native | the client you passed                       |
| Datadog              | the `datadogRum` you passed                 |
| Datadog React Native | the `DdRum` you passed                      |
| Datadog Logs         | the `datadogLogs` you passed                |
| OpenTelemetry        | the logger you passed                       |
| HTTP                 | the `request` you passed                    |
| Console              | the writer function                         |

The name is typed. A destination that was not configured is a compile error, and at runtime it throws a `FlareError` with the code `INVALID_CONFIGURATION`, because it is a programming mistake and not a reporting failure.

## What stops applying

Anything you do through `native` goes straight to the provider. It bypasses:

- **Redaction and scrubbing.** What you pass is sent as it is.
- **Account isolation.** A tag set on the SDK's global scope stays there across an account switch, and appears on reports for the next account.
- **Routing and receipts.** Flare does not know the call happened.

Flare clears only what Flare wrote. What you set through `native` is yours to clear.

## Watching a destination

`status` is observable, which is what every binding's `useDestinationStatus` uses. The devtools read `flare.diagnostics` instead:

```ts
const { status } = flare.destination("sentry");

const unsubscribe = status.subscribe(() => {
  console.log(status.get().state);
});
```

The states are `idle`, `ready`, `failed` with the error its adapter's `open` threw, and `disposed`. The shipped adapters throw a `FlareError` whose `code` is `NOT_INITIALIZED` or `UNSUPPORTED`, so you can branch on it:

```ts
import { FlareError } from "@priemskiyyy/flare";

const current = flare.destination("sentry").status.get();

if (current.state === "failed" && current.error instanceof FlareError) {
  console.warn(current.error.code, current.error.message);
}
```

An `open` that returns no session with a `submit` function fails the start too, with the code `INVALID_ANSWER`.
