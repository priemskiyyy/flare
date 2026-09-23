---
description: "What Sentry, Bugsnag, Crashlytics, PostHog, Datadog and OpenTelemetry cannot do through Flare, how each adapter says so on the receipt, and which parts have not been verified on a device."
---

# Provider limitations

Flare does not paper over a provider. When a provider cannot do something, the adapter records a loss on the receipt, or skips the report with a reason. It never imitates the feature by changing global state around a call, because that is how one report's data ends up on another.

Each receipt says what happened to that one report:

```ts
const status = await flare.capture(error).settled;

if (status.state === "settled") {
  const sentry = status.outcomes.sentry;

  sentry?.status; // "submitted", "skipped", "failed", ...

  if (sentry?.status === "submitted") {
    sentry.evidence; // what "submitted" proves
    sentry.losses; // what this provider could not carry
  }
}
```

A destination whose SDK is not set up fails to start with a `FlareError` whose code is `NOT_INITIALIZED`, or `UNSUPPORTED` when the SDK lacks what the adapter needs. Its reports wait in the startup buffer, and `flare.start()` tries again.

## Sentry

- **Start after `Sentry.init`.** Before it, the start fails with `NOT_INITIALIZED`.
- **Tags are limited by Sentry.** A tag key over 32 characters or a value over 200 is cut by Sentry. The adapter records it as a `truncated` loss.
- **Some names are the adapter's.** A tag named `flare.report_id` is replaced by the report id, and for an `AggregateError` a context named `flare.aggregated` is replaced by its errors. Each is an `unsupported` loss.
- **Evidence is `sdk-call-returned`.** Sentry returns an event id before anything is sent.
- **On React Native, a swallowed error is a failure.** Sentry's `withScope` logs an error thrown inside it and answers nothing, so the outcome is `failed`, with a `FlareError` whose code is `SUBMISSION_FAILED`.
- **The browser SDK queues in memory.** Events that have not left when the page closes are gone. [Flush](flush.md) when the page is hidden.
- **In React Native, a flush is a handoff.** It reaches the native SDK, which persists events and sends them on its own schedule.
- **One SDK, one destination.** Sentry is one process-wide instance. Register it under one destination name: two destinations over the same SDK report every event twice.

## Bugsnag

- **Start after `Bugsnag.start`.** Before it, the start fails with `NOT_INITIALIZED`.
- **No message events.** Skipped by default, or sent as an error with `messages: "as-error"`.
- **No `fatal` level.** Bugsnag has `error`, `warning` and `info`. A `fatal` report is sent as `error`, with the loss recorded.
- **Some context names are the adapter's.** Contexts named `tags`, `flare` or `flare.aggregated` are not written, and each is an `unsupported` loss.
- **Breadcrumbs need the `Breadcrumb` class.** The static API does not expose it at runtime, so the adapter takes it from the same package as an option.
- **No flush and no event id.** The SDK offers neither. In the browser there is no queue either. In React Native, the native SDK persists events.
- **Filtering is invisible.** When one of your Bugsnag `onError` callbacks discards an event, Bugsnag still completes the delivery callback without an error, so the outcome is `submitted`. The evidence says the callback completed, not that the event was sent.
- **Mirrored breadcrumbs cannot be removed.** After an account switch, a crash Bugsnag reports on its own can still show the previous account's entries.

## Crashlytics

Crashlytics has the most limited client API of these providers, and the adapter is honest about it.

- **Nothing is per report.** The user id, custom keys and logs are global to the app. The adapter records the error and lists `identity.user`, `tags`, `contexts`, `breadcrumbs`, `operation` and `exception.aggregated` as `unsupported` losses when the report had them, and `level` when it is not `error`.
- **No messages and no levels.** A `message()` is skipped. Everything recorded is a non-fatal.
- **Metadata only through the ambient mirror.** Turn on `ambient` and the session's user, tags, contexts and breadcrumbs are written to Crashlytics' global state, where native crashes pick them up too. Custom keys are limited to 64, values are cut at 1024 characters, and breadcrumbs become log lines.
- **Account safety costs reports.** With `ambient.user` on, a report whose user differs from the mirrored user is skipped as `identity-mismatch`. Without it, a report whose account changed since it was captured is skipped the same way. Filing it under the wrong account would be worse than not filing it.
- **Stack traces are rebuilt.** The adapter never holds your error object, so it rebuilds an `Error` from the sanitized name, message and stack. The `cause` chain is kept.

## PostHog

`@priemskiyyy/flare-posthog` in the browser and `@priemskiyyy/flare-posthog-react-native` on React Native map a report the same way.

- **The user is PostHog's person.** PostHog files every event under the person it identifies, and one event cannot go to someone else. A report whose user is not PostHog's distinct id is skipped as `identity-mismatch`, so give `posthog.identify` and `flare.user` the same id.
- **No messages.** PostHog tracks exceptions, so a `message()` is skipped.
- **Some names are PostHog's.** A tag or context named with a leading `$`, such as `$set`, or named `distinct_id`, `token` or `__proto__`, would change the person, move the event or not survive the merge, and the names `flare.report_id`, `flare.operation` and `flare.aggregated` belong to the adapter. Such a tag or context is not written, and the receipt lists it as a loss. So are a context that shares a tag's name and breadcrumb data named `$message` or `$timestamp`.
- **In the browser, start after `posthog.init`.** Before it, the start fails with `NOT_INITIALIZED`, and a slim bundle initialized without error tracking fails with `UNSUPPORTED`.
- **Filtering is visible in the browser.** posthog-js answers nothing for an event its own filters drop, and the adapter reports that as `dropped` with the reason `provider-filtered`. posthog-react-native answers nothing either way, and gives no event id.
- **On React Native, the client loads first.** The adapter waits until the client has loaded its storage, and a report whose deadline passes meanwhile is not sent.
- **Flush only on React Native.** posthog-js sends its batches on its own schedule and offers no flush. On React Native, the flush sends the client's queue.

## Datadog

`@priemskiyyy/flare-datadog` sends RUM errors in the browser, and `@priemskiyyy/flare-datadog-react-native` on React Native.

- **The user is Datadog's own.** RUM attaches the user it was given to every event. In the browser, a report whose user is not that user is skipped as `identity-mismatch`. On React Native the SDK does not reveal its user, so the adapter skips a report whose account changed since it was captured, and lists the user as a loss on every other report that has one.
- **No messages and no levels.** RUM records errors, so a `message()` is skipped, and the level travels as the attribute `flare.level`.
- **Everything else is one attribute.** A report's tags, contexts, breadcrumbs and more travel under `flare` in the error's context, because Datadog merges its global context over an error's own attributes. Keep the name `flare` out of your global context. In the browser that merge skips `__proto__`, so a tag or context of that name is an `unsupported` loss.
- **In the browser, start after `datadogRum.init`.** Before it, the start fails with `NOT_INITIALIZED`. On React Native, a call made before the SDK initializes waits in the SDK's own bounded buffer.
- **Filtering is invisible.** Sampling, `beforeSend`, rate limits and the React Native error event mapper discard an error without saying so, and there is no event id.
- **No flush.** RUM and the native SDKs send batches on their own schedule.

## Datadog Logs

- **The user is Datadog's own.** Datadog attaches the user set with `setUser` to every log. A report whose user is not that user is skipped as `identity-mismatch`.
- **Messages are logs.** Every report is sent, messages included, with its level as the log's status: `critical` for `fatal`, then `error`, `warn` and `info`.
- **`__proto__` is lost.** Datadog's merge skips it, so a tag or context of that name is an `unsupported` loss.
- **Start after `init`.** Before it, the start fails with `NOT_INITIALIZED`.
- **Filtering is invisible.** The logger's level and handler, tracking consent, sampling, `beforeSend` and rate limits can drop a log without saying so, and there is no event id.
- **No flush.** The SDK sends its batches on its own schedule, and when the page is hidden.

## OpenTelemetry

- **Nothing is lost.** A log record carries the report's own user, severity, exception and attributes.
- **Filtering is invisible.** A logger that is disabled, below its minimum severity or shut down drops a record without saying so, and there is no event id.
- **Attribute limits are the SDK's.** The SDK keeps at most 128 attributes per record by default, and cuts values past `attributeValueLengthLimit` when you set one, without a loss on the receipt.
- **Flush needs `forceFlush`.** Without it, `flare.flush()` reports `unsupported`.

## Not verified on a device

The adapters are tested against fakes that are typechecked against the real SDK declarations, and the SDK behavior they rely on was read in the SDK source. That is not the same as a run on a device against the real backend. See [the verification matrix](verification.md) for exactly what has and has not been exercised.

## What no adapter can do

- Tell you that a provider's own filter discarded an event, unless the SDK says so. Only posthog-js does, and its adapter reports `provider-filtered`.
- Confirm that a provider stored, grouped or displayed an event.
- Report a native crash. The provider's native SDK does that.
- Apply Flare's redaction to what a provider's automatic instrumentation collects by itself.
