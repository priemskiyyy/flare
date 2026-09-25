# Changelog

## @priemskiyyy/flare 0.1.0 - 2026-09-25

- First release. `Flare` builds, isolates, sanitizes and routes error reports, and hands each one to the destinations it was routed to.
- Reports are composed from application defaults, the session, an operation scope and capture options, in that order, and every destination receives the same frozen, redacted plain data. The thrown value itself never leaves the core.
- An identity generation starts whenever the user id changes. Session tags, contexts and breadcrumbs are cleared, and a scope created under a previous identity is dropped as `stale-scope`.
- `capture()` and `message()` are synchronous and return a receipt whose `settled` promise never rejects. Outcomes are `submitted`, `dropped`, `skipped`, `failed` and `indeterminate`. `submitted` names the evidence it rests on, with the provider's `event.id` when there is one.
- Typed tags, contexts and breadcrumbs through any Standard Schema validator, validated synchronously. An invalid piece costs only itself.
- Redaction by a `redact(key, path)` predicate, `isSensitiveKey` by default, and a `scrub` for free text, both applied before anything is retained, buffered, observed or sent. Either one throwing fails closed.
- `defaults.to` sends reports to a list of destinations or to those a function picks per report, and a report's own `to` replaces it.
- A bounded startup buffer per destination, a deadline per submission, dedupe by explicit key and by object identity, a per-minute rate limit, and a guard against captures made from inside an adapter. Durations are milliseconds, and every numeric option is checked at construction.
- An adapter is a plain `ReporterAdapter`, a name and an `open`, and the runtime owns the session's lifecycle. `SanitizedError` builds the `Error` an SDK needs from a sanitized report. `createMockAdapter` is under `./mock`, and the `testReporterAdapter` conformance suite under `./testing`.
- Flare's own errors are `FlareError`s with a `code`: `INVALID_CONFIGURATION`, `NOT_INITIALIZED`, `UNSUPPORTED`, `SUBMISSION_FAILED` or `INVALID_ANSWER`. Only misconfiguration throws.
- Passive, payload-free diagnostics: a snapshot and an event stream that cost nothing while nobody observes them.

## @priemskiyyy/flare-react 0.1.0 - 2026-09-25

- First release. `FlareProvider`, `useFlare`, `useFlareStatus`, `useDestinationStatus` and `FlareErrorBoundary`.
- The provider owns no lifetime: it never starts, stops or disposes anything. The status hooks observe only, and read `idle` on the server.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-vue 0.1.0 - 2026-09-25

- First release. `FlareProvider`, `useFlare`, `useFlareStatus`, `useDestinationStatus` and `FlareErrorBoundary`, which reports what Vue's error capture sees and stops it there.
- The provider owns no lifetime. The status composables observe only, and read `idle` on the server and until mounted, so hydration never mismatches.
- Requires `@priemskiyyy/flare` 0.1 and Vue 3.5.

## @priemskiyyy/flare-solid 0.1.0 - 2026-09-25

- First release. `FlareProvider`, `useFlare`, `useFlareStatus`, `useDestinationStatus` and `FlareErrorBoundary`, over Solid's own `ErrorBoundary`.
- The provider owns no lifetime. The status primitives observe only, and read `idle` on the server and until mounted.
- Requires `@priemskiyyy/flare` 0.1 and Solid 1.9.

## @priemskiyyy/flare-svelte 0.1.0 - 2026-09-25

- First release. `FlareProvider`, `useFlare`, `useFlareStatus`, `useDestinationStatus` and `FlareErrorBoundary`, over `svelte:boundary`. Ships Svelte sources for the application's compiler.
- The provider owns no lifetime. The status utilities observe only, and read `idle` on the server and until mounted.
- Requires `@priemskiyyy/flare` 0.1 and Svelte 5.7.

## @priemskiyyy/flare-devtools 0.1.0 - 2026-09-25

- First release. A framework-independent inspector in a shadow root, with its own bundled runtime: a launcher that lights up for an unseen error, a panel that resizes and docks, destinations with their status and queues, and a searchable, filterable timeline that carries no report content.
- Wrappers under `./react`, `./vue`, `./solid` and `./svelte` that read the Flare from their provider.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-trace 0.1.0 - 2026-09-25

- First release. `traceBreadcrumbs` turns mapped Trace events into breadcrumbs, with only the data a mapper returns, the time each event occurred, and no history replayed.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-console 0.1.0 - 2026-09-25

- First release. `console()` prints each report through the console or an injected writer.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-http 0.1.0 - 2026-09-25

- First release. `http({ request })` sends each report once through your own client, and a resolved request is `backend-acknowledged` evidence, with the backend's id on the receipt when it gives one. A report whose account has changed since it was captured is skipped as `auth-subject-mismatch`, so it is never sent with another account's credentials.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-sentry 0.1.0 - 2026-09-25

- First release, one entry point for the browser and React Native. Event-local user, tags, contexts and breadcrumbs through a forked scope over the SDK the application initialized, and an opt-in ambient integration.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-bugsnag 0.1.0 - 2026-09-25

- First release, one entry point for the browser and React Native. Event-local user, metadata, severity and breadcrumbs through `notify`'s `onError` callback over the SDK the application started, opt-in messages, and an opt-in ambient integration.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-crashlytics 0.1.0 - 2026-09-25

- First release, for React Native. Non-fatal errors through `recordError`, with everything beyond the error listed as a loss, and an opt-in ambient integration for the user id, keys and logs.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-posthog 0.1.0 - 2026-09-25

- First release, for posthog-js in the browser. Each exception is one `$exception` event whose properties are the report's own, with its breadcrumbs as exception steps, sent only while PostHog identifies the report's user. Messages are skipped.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-posthog-react-native 0.1.0 - 2026-09-25

- First release, for posthog-react-native. Maps each exception as `@priemskiyyy/flare-posthog` does, waits until the client has loaded its storage before it compares the report's user with the client's distinct id, and flushes the client's queue. Messages are skipped.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-datadog 0.1.0 - 2026-09-25

- First release, for `@datadog/browser-rum`. Each exception is one RUM error carrying the report's own attributes under `context.flare`, sent only while RUM's user is the report's own. Messages are skipped.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-datadog-react-native 0.1.0 - 2026-09-25

- First release, for `@datadog/mobile-react-native`. Each exception is one RUM error recorded at its capture time, with its causes and the report's own attributes under `flare`. The SDK does not reveal its user, so a report whose user has signed out since is skipped. Messages are skipped.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-datadog-logs 0.1.0 - 2026-09-25

- First release, for `@datadog/browser-logs`. Each report, messages included, is one log with its own status and error and the report's attributes under `flare`, sent only while Datadog's user is the report's own.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-opentelemetry 0.1.0 - 2026-09-25

- First release. Each report is one OpenTelemetry log record with its own severity, user, exception and attributes, through the logger your provider made, and so to any OTLP backend. An optional `forceFlush` makes `flare.flush()` wait for the export.
- Requires `@priemskiyyy/flare` 0.1 and `@opentelemetry/api-logs` 0.200 or later.
