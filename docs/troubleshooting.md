---
description: "Find out why a Flare report did not arrive, why metadata is missing, why an error shows up twice, and what each constructor error means."
---

# Troubleshooting

Start with the receipt or the [devtools](devtools.md) timeline. Flare records a reason for every report that does not go out, so there is rarely a need to guess.

```ts
const status = await flare.capture(error).settled;
console.log(status);
```

## A report did not arrive

**The receipt is `dropped`.** The `reason` names the cause:

| Reason             | What to check                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `disposed`         | Something called `dispose()`. A disposed Flare cannot be restarted.                         |
| `rate-limited`     | More than `limits.reportsPerMinute` reports. Look for a loop that throws.                   |
| `reentrant`        | The capture came from inside an adapter's submit, often an instrumented `console`.          |
| `stale-scope`      | The [scope](scopes.md) was created under a previous account.                                |
| `sanitizer-failed` | Your `privacy.scrub` threw or returned something that is not a string.                      |
| `route-failed`     | Your `route` threw, returned something that is not a list, or named an unknown destination. |
| `no-destinations`  | Routing selected nothing.                                                                   |

**The destination's outcome is `skipped` with `unavailable` or `start-failed`.** Read the destination's status:

```ts
console.log(flare.destination("sentry").status.get());
// { state: "unavailable", reason: "Sentry is not initialized. ..." }
```

A borrowed SDK must be initialized before `flare.start()`. Calling `start()` again retries a destination whose start failed.

**The outcome is `dropped` with `buffer-expired`.** Nothing called `start()` within a minute of the capture.

**The outcome is `indeterminate` with `deadline`.** The provider did not answer within `deadlineMs`. The report may have arrived anyway.

**The outcome is `submitted`.** Flare handed it over. Check what the `evidence` proves, then look in the provider: its own sampling, filters, `beforeSend` hook, rate limits and quota are all outside Flare.

## Metadata is missing

- **Check `losses` on the outcome.** A tag that failed its schema is `invalid`, a value that was cut is `truncated`, and something the provider cannot carry is `unsupported`.
- **A value reads `[Redacted]`.** Its key matches a redaction rule. The defaults match keys containing `token`, `password`, `secret`, `cookie`, `authorization` or `api key`.
- **Tags and breadcrumbs vanished after sign-in.** That is the [account boundary](identity.md) working.
- **Crashlytics shows nothing but the error.** It cannot attach metadata to one report. Turn on its ambient mirror. See [provider limitations](provider-limitations.md).
- **The React component stack is missing.** With a typed schema, declare the `react` context, or it is dropped as `invalid`.

## An error arrives twice

- **Two owners for uncaught errors.** Your provider SDK's global handler and your own `window` listener both report it. Keep one.
- **React 19 and a console integration.** React logs a caught render error through `console.error`, and a provider's console integration turns that into a second event. Turn the integration off.
- **Caught twice.** The same error object reported twice within a second is deduped per destination. An error that is wrapped in a new `Error` before the second capture is a different object. Give both captures the same `dedupe.key`.

## The constructor throws

Misconfiguration is the one thing Flare throws for, so that you find it at startup:

```text
Flare accepts either default or route, not both.
Flare default names an unknown destination: "sentri".
Flare destinations "sentry" and "errors" drive the same singleton SDK. Register it once.
```

`flare.destination(name)` also throws for a name that was never configured.

## Status says `ready`, but nothing arrives

`ready` means the SDK is usable locally. It does not mean the network is reachable or that the provider accepted your key. That is visible only in the provider's own tools, or on a receipt from the HTTP adapter.
