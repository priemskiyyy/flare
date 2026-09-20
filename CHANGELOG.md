# Changelog

## @priemskiyyy/flare 0.1.0 - Unreleased

- First release. `Flare` builds, isolates, sanitizes and routes error reports, and hands each one to the destinations it was routed to.
- Reports are composed from application defaults, the session, an operation scope and capture options, in that order, and every destination receives the same frozen, redacted plain data. The thrown value itself never leaves the core.
- An identity generation starts whenever the user id changes. Session tags, contexts and breadcrumbs are cleared, and a scope created under a previous identity is dropped as `stale-scope`.
- `capture()` and `message()` are synchronous and return a receipt whose `settled` promise never rejects. Outcomes are `submitted`, `dropped`, `skipped`, `failed` and `indeterminate`, and `submitted` names the evidence it rests on.
- Pre-release API cleanup: capture options use `dedupe: { key }`; submitted adapter results and receipt outcomes use `event: { id }` in place of `dedupeKey` and `eventId`.
- Typed tags, contexts and breadcrumbs through any Standard Schema validator, validated synchronously. An invalid piece costs only itself.
- Redaction by key, by path and by a string scrubber runs before anything is retained, buffered, observed or sent. A scrubber that throws fails closed.
- A bounded startup buffer per destination, a deadline per submission, dedupe by explicit key and by object identity, a per-minute storm limit, and a guard against captures made from inside an adapter.
- `createReporterAdapter`, `rebuildError`, `createMockAdapter` under `./mock`, and the `testReporterAdapter` conformance suite under `./testing`.
- Passive, payload-free diagnostics: a snapshot and an event stream that cost nothing while nobody observes them.

## @priemskiyyy/flare-react 0.1.0 - Unreleased

- First release. `FlareProvider`, `useFlare`, `useFlareStatus`, `useDestinationStatus` and `FlareErrorBoundary`.
- The provider owns no lifetime: it never starts, stops or disposes anything. The status hooks observe only, and read `idle` on the server.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-vue 0.1.0 - Unreleased

- First release. `FlareProvider`, `useFlare`, `useFlareStatus`, `useDestinationStatus` and `FlareErrorBoundary`, which reports what Vue's error capture sees and stops it there.
- The provider owns no lifetime. The status composables observe only, and read `idle` on the server and until mounted, so hydration never mismatches.
- Requires `@priemskiyyy/flare` 0.1 and Vue 3.5.

## @priemskiyyy/flare-solid 0.1.0 - Unreleased

- First release. `FlareProvider`, `useFlare`, `useFlareStatus`, `useDestinationStatus` and `FlareErrorBoundary`, over Solid's own `ErrorBoundary`.
- The provider owns no lifetime. The status primitives observe only, and read `idle` on the server and until mounted.
- Requires `@priemskiyyy/flare` 0.1 and Solid 1.9.

## @priemskiyyy/flare-svelte 0.1.0 - Unreleased

- First release. `FlareProvider`, `useFlare`, `useFlareStatus`, `useDestinationStatus` and `FlareErrorBoundary`, over `svelte:boundary`. Ships Svelte sources for the application's compiler.
- The provider owns no lifetime. The status utilities observe only, and read `idle` on the server and until mounted.
- Requires `@priemskiyyy/flare` 0.1 and Svelte 5.7.

## @priemskiyyy/flare-devtools 0.1.0 - Unreleased

- First release. A framework-independent inspector in a shadow root, with its own bundled runtime: a launcher that lights up for an unseen error, a panel that resizes and docks, destinations with what each declared, and a searchable, filterable timeline that carries no report content.
- Wrappers under `./react`, `./vue`, `./solid` and `./svelte` that read the Flare from their provider.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-trace 0.1.0 - Unreleased

- First release. `traceBreadcrumbs` turns mapped Trace events into breadcrumbs, with only the data a mapper returns, the time each event occurred, and no history replayed.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-console 0.1.0 - Unreleased

- First release. Prints each report through the console or an injected writer.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-http 0.1.0 - Unreleased

- First release. Posts each report once as JSON, with its id as the idempotency key and a `2xx` answer as `backend-acknowledged` evidence. With `authorize`, a report is never sent with another account's credentials.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-sentry 0.1.0 - Unreleased

- First release, for the browser and, under `./react-native`, for React Native. Event-local user, tags, contexts and breadcrumbs through a forked scope, borrowed and owned lifecycles, and an opt-in ambient integration.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-bugsnag 0.1.0 - Unreleased

- First release, for the browser and, under `./react-native`, for React Native. Event-local user, metadata, severity and breadcrumbs through `notify`'s `onError` callback, opt-in messages, and an opt-in ambient integration.
- Requires `@priemskiyyy/flare` 0.1.

## @priemskiyyy/flare-crashlytics 0.1.0 - Unreleased

- First release, for React Native. Non-fatal errors through `recordError`, with every event-local capability declared unsupported and listed as a loss, and an opt-in ambient integration for the user id, keys and logs.
- Requires `@priemskiyyy/flare` 0.1.
