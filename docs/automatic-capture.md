---
description: "Why Flare installs no global error handlers, who captures uncaught errors and native crashes instead, and how to avoid reporting an error twice."
---

# Automatic capture ownership

Flare installs no global handlers. It does not listen for `error` or `unhandledrejection`, it does not replace `ErrorUtils` in React Native, and it does not patch `console`.

## Why

Uncaught errors and native crashes are already owned by your provider SDK, and it does that job better than a JavaScript library can:

- A native crash takes the JavaScript runtime down with it. Only a native SDK that writes to disk and reports on the next launch can see it.
- Two libraries that both install a global handler report every uncaught error twice, in an order neither controls.
- A handler that Flare installed would have to be removed on `dispose()`, and restoring a chain of handlers that someone else has since extended cannot be done safely.

Sentry, Bugsnag and Crashlytics each capture uncaught errors and native crashes on their own. Datadog RUM, Datadog Logs with `forwardErrorsToLogs` and PostHog's exception autocapture collect errors by themselves too. The HTTP, console and OpenTelemetry adapters capture nothing by themselves.

## Who reports what

| Failure                                       | Who reports it                                    |
| --------------------------------------------- | ------------------------------------------------- |
| An error you catch                            | You, with `flare.capture(error)`                  |
| A render error in React, Vue, Solid or Svelte | The binding's `FlareErrorBoundary`, through Flare |
| An uncaught error or unhandled rejection      | The provider SDK's own handler, outside Flare     |
| A native crash                                | The provider's native SDK, outside Flare          |

Reports that a provider captures by itself do not pass through Flare, so they get no routing, no receipt and no Flare redaction. To make them carry the same user, tags, contexts and breadcrumbs, turn on the adapter's ambient mirror. Sentry, Bugsnag and Crashlytics have one; the others deliberately do not, because their SDK merges global state into every event:

```ts
import { sentry } from "@priemskiyyy/flare-sentry";
import * as Sentry from "@sentry/browser";

const destination = sentry({
  sdk: Sentry,
  ambient: { user: true, tags: true, contexts: true, breadcrumbs: true },
});
```

The mirror copies session data, which is already sanitized, into the provider SDK's global state. Each part is opt-in, and nothing is mirrored by default. An adapter clears the user, tags and contexts it mirrored when the account changes and when it is disposed. Mirrored breadcrumbs are cleared only by Sentry, on an account change; Bugsnag breadcrumbs and Crashlytics log lines cannot be taken back.

## If you only use the HTTP adapter

Then nothing owns uncaught errors, and you decide. The same holds for the console and OpenTelemetry adapters. Forwarding them is a few lines, and they stay yours to remove:

```ts
const handleError = (event: ErrorEvent) => {
  flare.capture(event.error, { tags: { source: "window.onerror" } });
};

const handleRejection = (event: PromiseRejectionEvent) => {
  flare.capture(event.reason, { tags: { source: "unhandledrejection" } });
};

window.addEventListener("error", handleError);
window.addEventListener("unhandledrejection", handleRejection);
```

Do this only when no provider SDK is doing it already, or every uncaught error arrives twice.

## Capturing inside a capture

If a provider SDK's own hook reports an error synchronously from inside Flare's submission to it, that capture is dropped with the reason `reentrant`. Without this rule, an adapter that fails while reporting would report its own failure, forever.
