---
description: "What Sentry, Bugsnag and Crashlytics cannot do through Flare, how each adapter declares it, and which parts have not been verified on a device."
---

# Provider limitations

Flare does not paper over a provider. When a provider cannot do something, the adapter declares it in its capabilities, records a loss on the receipt, or skips the report with a reason. It never imitates the feature by changing global state around a call, because that is how one report's data ends up on another.

Read a destination's capabilities at runtime:

```ts
const { capabilities } = flare.destination("sentry");

capabilities.eventLocal.breadcrumbs; // can it attach breadcrumbs to one report?
capabilities.messages; // does it accept message()?
capabilities.evidence; // what does "submitted" prove?
capabilities.flush; // what does a flush reach?
capabilities.queue; // does the SDK keep events across restarts?
```

## Sentry

- **Tags are limited by Sentry.** A tag key over 32 characters or a value over 200 is cut by Sentry. The adapter records it as a `truncated` loss.
- **Evidence is `sdk-call-returned`.** Sentry returns an event id before anything is sent.
- **The browser SDK queues in memory.** Events that have not left when the page closes are gone. [Flush](flush.md) when the page is hidden.
- **In React Native, a flush is a handoff.** It reaches the native SDK, which persists events and sends them on its own schedule.
- **One SDK, one destination.** Sentry is a singleton. Configuring two Flare destinations over the same SDK is refused at construction.

## Bugsnag

- **No message events.** Skipped by default, or sent as an error with `messages: "as-error"`.
- **No `fatal` level.** Bugsnag has `error`, `warning` and `info`. A `fatal` report is sent as `error`, with the loss recorded.
- **Breadcrumbs need the `Breadcrumb` class or the ambient breadcrumb mirror.** With neither, they are recorded as an `unsupported` loss.
- **No flush.** The SDK offers none. In the browser there is no queue either. In React Native, the native SDK persists events.
- **Filtering is invisible.** When one of your Bugsnag `onError` callbacks discards an event, Bugsnag still completes the delivery callback without an error, so the outcome is `submitted`. The evidence says the callback completed, not that the event was sent.
- **An owned SDK is not closed.** Bugsnag cannot be stopped once started.

## Crashlytics

Crashlytics has the most limited client API of the three, and the adapter is honest about it.

- **Nothing is per report.** The user id, custom keys and logs are global to the app. The adapter records the error and lists `identity.user`, `tags`, `contexts`, `breadcrumbs`, `operation` and `exception.aggregated` as `unsupported` losses when the report had them.
- **No messages and no levels.** A `message()` is skipped. Everything recorded is a non-fatal.
- **Metadata only through the ambient mirror.** Turn on `ambient` and the session's user, tags, contexts and breadcrumbs are written to Crashlytics' global state, where native crashes pick them up too. Custom keys are limited to 64, values are cut at 1024 characters, and breadcrumbs become log lines.
- **Account safety costs reports.** With `ambient.user` on, a report whose user differs from the mirrored user is skipped as `identity-mismatch`. Filing it under the wrong account would be worse than not filing it.
- **Stack traces are rebuilt.** The adapter never holds your error object, so it rebuilds an `Error` from the sanitized name, message and stack. The `cause` chain is kept.

## Not verified on a device

The adapters are tested against fakes that are typechecked against the real SDK declarations, and the SDK behavior they rely on was read in the SDK source. That is not the same as a run on a device against the real backend. See [the verification matrix](verification.md) for exactly what has and has not been exercised.

## What no adapter can do

- Tell you that a provider's own filter discarded an event. The `provider-filtered` reason exists for adapters whose SDK reports it, and none of the built-in SDKs does.
- Confirm that a provider stored, grouped or displayed an event.
- Report a native crash. The provider's native SDK does that.
- Apply Flare's redaction to what a provider's automatic instrumentation collects by itself.
