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

| Reason             | What to check                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `disposed`         | Something called `dispose()`. A disposed Flare cannot be restarted.                                                                  |
| `rate-limited`     | More than `rateLimits.perMinute` reports. Look for a loop that throws.                                                               |
| `reentrant`        | The capture came synchronously from inside an adapter's `submit`, often an instrumented `console`.                                   |
| `stale-scope`      | The [scope](scopes.md) was created under a previous account.                                                                         |
| `sanitizer-failed` | Your `privacy.redact` or `privacy.scrub` threw, `scrub` returned something that is not a string, or a capture option's getter threw. |
| `route-failed`     | Your `defaults.to` function threw, returned something that is not a list, or named an unknown destination, or a report's `to` did.   |
| `no-destinations`  | Routing selected nothing.                                                                                                            |

**The destination's outcome is `skipped` with `start-failed`.** Read the destination's status:

```ts
console.log(flare.destination("sentry").status.get());
// { state: "failed", error: FlareError { code: "NOT_INITIALIZED", ... } }
```

The error is a `FlareError` whose `code` says what to fix. `NOT_INITIALIZED` means the provider SDK was not set up before `flare.start()`, `UNSUPPORTED` that it lacks what the adapter needs, such as PostHog without error tracking, and `INVALID_ANSWER` that the adapter's `open` returned no usable session. Set the SDK up and call `start()` again: it retries a destination whose start failed, and delivers the reports that waited for it within the buffer's bounds.

**The outcome is `dropped` with `buffer-expired`.** Nothing started the destination within `buffer.maxAge` of the capture, a minute by default.

**The outcome is `indeterminate` with `timeout`.** The provider did not answer within `timeout`. The report may have arrived anyway.

**The outcome is `skipped` with `identity-mismatch`.** The destination files every event under a user its SDK holds, and that user is not the report's. Give the SDK the same id as `flare.user`: `posthog.identify`, or `identify` on the React Native client, and `setUser` on `datadogRum` or `datadogLogs`. With Crashlytics and `ambient.user`, the mirrored id differs. Datadog on React Native, and Crashlytics without `ambient.user`, skip a report whose account changed since it was captured. That is on purpose.

**The outcome is `skipped` with `auth-subject-mismatch`.** The HTTP adapter skipped a report whose account changed since it was captured, because your client now authenticates as someone else.

**The outcome is `skipped` with `unsupported-report-kind`.** The destination has no notion of a message. Crashlytics, Datadog RUM and PostHog skip every `message()`, and Bugsnag does unless you pass `messages: "as-error"`.

**The outcome is `dropped` with `provider-filtered`.** posthog-js' own filters dropped the event: opt-out, bot detection, rate limits, suppression rules or `before_send`.

**The outcome is `failed`.** The adapter threw, rejected or answered `failed`, and `error` holds why. A `FlareError` with the code `SUBMISSION_FAILED` means the SDK swallowed its own error, as Sentry does on React Native inside `withScope`. One with `INVALID_ANSWER` means the adapter answered with something its contract does not allow.

**The outcome is `submitted`.** Flare handed it over. Check what the `evidence` proves, then look in the provider: its own sampling, filters, `beforeSend` hook, rate limits and quota are all outside Flare.

## Metadata is missing

- **Check `losses` on the outcome.** A tag that failed its schema is `invalid`, a value that was cut is `truncated`, and something the provider cannot carry is `unsupported`.
- **A value reads `[Redacted]`.** `redact` named its key. By default `isSensitiveKey` does, for keys that name a credential: `token`, `authorization`, `password`, `secret`, `cookie`, `credential`, `bearer`, `jwt`, `session_id`, `api_key`, `access_key` and `private_key`, in any case or spelling of the separator.
- **A whole context, or a breadcrumb's data, is gone.** `redact` named the context or the breadcrumb itself. See [privacy](privacy.md).
- **The level is not the one you passed.** A `level` that is not `fatal`, `error`, `warning` or `info` is an `invalid` loss, and the report keeps its default.
- **Tags and breadcrumbs vanished after sign-in.** That is the [account boundary](identity.md) working.
- **Crashlytics shows nothing but the error.** It cannot attach metadata to one report. Turn on its ambient mirror. See [provider limitations](provider-limitations.md).
- **The React component stack, or Vue's `vue` context, is missing.** With a typed schema, declare the `react` or `vue` context, or it is dropped as `invalid`.

## An error arrives twice

- **Two owners for uncaught errors.** Your provider SDK's global handler and your own `window` listener both report it. Keep one.
- **React 19 and a console integration.** React logs a caught render error through `console.error`, and a provider's console integration turns that into a second event. Turn the integration off.
- **Caught twice.** The same error object reported twice within a second is deduped per destination. An error that is wrapped in a new `Error` before the second capture is a different object. Give both captures the same `dedupe.key`.

## The constructor throws

Misconfiguration is the one thing Flare throws for, so that you find it at startup:

```text
Flare has no destination named "sentri".
```

Every such error is a `FlareError` with the code `INVALID_CONFIGURATION`, and its message names what is wrong:

- a `defaults.to` list, or `flare.destination(name)`, naming a destination you never configured
- a count or a duration that cannot work, such as `timeout must be a number of milliseconds from 0 to 2147483647.` See [configuration](configuration.md).
- a `redact` or `scrub` that is not a function: `privacy.redact must be a function.`
- `defaults` that fail the schema, `Flare's defaults are invalid at tags.area.`, or that `redact` or `scrub` fails on, `Flare's defaults could not be sanitized.`, with the failure as its `cause`

The bindings throw the same error when a hook or a boundary is used outside a `FlareProvider`, and the devtools do when `mount()` is called twice.

## Status says `ready`, but nothing arrives

`ready` means the SDK is usable locally. It does not mean the network is reachable or that the provider accepted your key. That is visible only in the provider's own tools, or on a receipt from the HTTP adapter.
