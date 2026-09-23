---
description: "Give Flare and the provider SDKs a bounded moment to hand off reports before a page unloads, a process exits or an app goes to the background."
---

# Flush and lifecycle

## start

`start()` opens every destination. It returns nothing and never throws. Until a destination is ready, its reports wait in a buffer, so a capture during startup is not lost.

```ts
flare.start();
```

Calling `start()` again is safe. It retries only the destinations whose start failed. A start fails because the provider SDK was not initialized or lacks what the adapter needs, never because of the network, so call it again once the SDK is set up.

## flush

`flush()` waits for the work that was accepted before the call, then asks each provider SDK to flush what it holds.

```ts
const result = await flare.flush({ timeout: 1500 });

result.drained; // true when everything accepted before the call has an outcome
result.destinations.sentry; // { status: "flushed" }
```

The timeout, two seconds by default, bounds the wait and nothing else. It cancels nothing, and it proves nothing about delivery. Reports captured after the call do not extend the wait. A provider's own flush gets what is left of the timeout, not all of it again. `flush` never throws: a timeout outside 0 to 2147483647 ms is clamped into that range. Unlike Flare's other timers, a pending flush keeps a Node process alive, because its caller is waiting for it.

| Status        | Meaning                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| `flushed`     | The provider's own flush completed.                                                                        |
| `timeout`     | Time ran out first.                                                                                        |
| `failed`      | The provider's flush threw or rejected, or answered with no status its contract allows (`INVALID_ANSWER`). |
| `unsupported` | The provider has no flush. Flare's own work for it did drain.                                              |
| `not-ready`   | The destination never became ready, so there was nothing to flush.                                         |

What `flushed` means depends on the provider:

| Provider                        | A completed flush means                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| Sentry in the browser           | The SDK emptied its in-memory queue onto the network.                                        |
| Sentry in React Native          | The events were handed to the native SDK, which persists and sends them on its own schedule. |
| PostHog on React Native         | The client sent its queue and PostHog answered for it.                                       |
| OpenTelemetry with `forceFlush` | The provider's processors exported what they held.                                           |
| every other adapter             | Nothing: there is no provider flush, and the result is `unsupported`.                        |

## When to flush

In a browser, flush when the page is being hidden. It is the last event a mobile browser reliably fires:

```ts
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flare.flush({ timeout: 1000 });
  }
});
```

On a server or in a script, flush before the process exits:

```ts
const shutdown = async () => {
  await flare.flush({ timeout: 2000 });
  flare.dispose();
};
```

In React Native, flush when the app goes to the background. See [React Native and Expo](react-native.md).

## dispose

`dispose()` releases every destination. It is synchronous, returns nothing and is safe to call twice.

```ts
flare.dispose();
```

After it:

- reports still waiting in a buffer settle as `dropped` with the reason `disposed`
- reports in flight settle as `indeterminate` with the reason `disposed`, because they may already have left
- new captures are dropped with the reason `disposed`
- adapters clear the user, tags and contexts their ambient mirror wrote to a provider SDK, and leave the SDK itself running. Mirrored breadcrumbs and Crashlytics log lines stay: Sentry keeps them in the list its own breadcrumbs share, and Bugsnag and Crashlytics cannot remove one.

A disposed Flare cannot be started again. Create a new one. In an application that lives as long as the page, you never need to dispose. It matters in tests, in hot module replacement and in server code that creates a Flare per unit of work.
