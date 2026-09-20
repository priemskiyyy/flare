---
description: "Give Flare and the provider SDKs a bounded moment to hand off reports before a page unloads, a process exits or an app goes to the background."
---

# Flush and lifecycle

## start

`start()` opens every destination. It returns nothing and never throws. Until a destination is ready, its reports wait in a buffer, so a capture during startup is not lost.

```ts
flare.start();
```

Calling `start()` again is safe. It retries only the destinations whose start failed, which makes it a reasonable thing to call when the device comes back online.

## flush

`flush()` waits for the work that was accepted before the call, then asks each provider SDK to flush what it holds.

```ts
const result = await flare.flush({ timeoutMs: 1500 });

result.drained; // true when everything accepted before the call has an outcome
result.destinations.sentry; // { status: "flushed" }
```

The timeout, two seconds by default, bounds the wait and nothing else. It cancels nothing, and it proves nothing about delivery. Reports captured after the call do not extend the wait.

| Status        | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| `flushed`     | The provider's own flush completed.                                |
| `timeout`     | Time ran out first.                                                |
| `failed`      | The provider's flush threw, and `error` holds why.                 |
| `unsupported` | The provider has no flush. Flare's own work for it did drain.      |
| `not-ready`   | The destination never became ready, so there was nothing to flush. |

What `flushed` means depends on the provider, and the destination's `capabilities.flush` says which:

| Capability             | A completed flush means                                                                      | Who                                 |
| ---------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------- |
| `sdk-queue`            | The SDK emptied its in-memory queue onto the network.                                        | Sentry in the browser               |
| `native-handoff`       | The events were handed to the native SDK, which persists and sends them on its own schedule. | Sentry in React Native              |
| `backend-acknowledged` | A server acknowledged them.                                                                  | no built-in adapter                 |
| `none`                 | There is no flush.                                                                           | Bugsnag, Crashlytics, HTTP, console |

## When to flush

In a browser, flush when the page is being hidden. It is the last event a mobile browser reliably fires:

```ts
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flare.flush({ timeoutMs: 1000 });
  }
});
```

On a server or in a script, flush before the process exits:

```ts
const shutdown = async () => {
  await flare.flush({ timeoutMs: 2000 });
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
- adapters clear the ambient state they wrote to a provider SDK, and an owned SDK that can be closed is closed

A disposed Flare cannot be started again. Create a new one. In an application that lives as long as the page, you never need to dispose. It matters in tests, in hot module replacement and in server code that creates a Flare per unit of work.
