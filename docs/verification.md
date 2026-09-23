---
description: "Exactly what Flare's test suite proves and what it does not: which behavior runs against fakes, which against real SDK types, and what has never run on a device or against a real backend."
---

# Verification matrix

A library about honest receipts should be honest about its own evidence. This page says what has been exercised and how, and what has not.

## How each layer is tested

| Layer                     | How it is tested                                                                                                                                                                               | What that does not cover                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Core                      | Unit tests over the mock adapter, with an injected clock and fake timers.                                                                                                                      | Real timers under load, real memory pressure.                                       |
| Provider adapters         | Unit tests over an in-process fake of each SDK, plus a shared conformance suite.                                                                                                               | Provider backends and native SDK behavior.                                          |
| Sentry composition        | The installed browser SDK runs in Node through `beforeSend`, verifying identity and breadcrumbs on a buffered report after an account switch.                                                  | Browser integrations, transport, sampling, symbolication and native scope behavior. |
| PostHog composition       | The installed posthog-js runs in jsdom with `fetch` stubbed, and `before_send` reads each event: the merge over the person and the super properties, the exception steps, and a dropped event. | Transport, batching, the React Native client.                                       |
| OpenTelemetry composition | The installed `@opentelemetry/sdk-logs` runs with an in-memory exporter, checking that every attribute survives the SDK's validation, with the record's severity, body and capture time.       | Exporters, a collector, a backend.                                                  |
| Provider SDK typing       | A typecheck-only contract file per adapter assigns the real SDK to the adapter's structural type.                                                                                              | SDK versions other than the ones installed here.                                    |
| HTTP adapter              | Unit tests over an in-process fake `request`, standing for the application's own client.                                                                                                       | Any real client, network or server.                                                 |
| React bindings            | Real React with Testing Library in jsdom, including Strict Mode, server render and hydration.                                                                                                  | A real browser, React Native's renderer.                                            |
| Vue bindings              | Real Vue with Vue Test Utils in jsdom, a server render in Node, and hydration of that server markup.                                                                                           | A real browser, Nuxt.                                                               |
| Solid bindings            | Real Solid with Solid Testing Library in jsdom, and a server render in Node.                                                                                                                   | Hydration itself, a real browser, SolidStart.                                       |
| Svelte bindings           | Real Svelte 5 with Svelte Testing Library in jsdom, a server render in Node, and `svelte-check`.                                                                                               | Hydration itself, a real browser, SvelteKit.                                        |
| Devtools                  | A real shadow root in jsdom, queried by role, and each wrapper rendered through its own binding. The example's browser tests open it in Chromium and check that it lists every destination.    | Resizing and pointer dragging in a real browser.                                    |
| Example application       | Unit tests in jsdom drive its flows through the buttons. `pnpm test:examples` drives the built page in Chromium with Playwright at 375 and 1280 px.                                            | Other browsers, and every real provider SDK: the page simulates them.               |
| Trace bridge              | Unit tests over a fake event source.                                                                                                                                                           | A real Trace, which is not released.                                                |
| Published packages        | The packed tarballs are installed into a clean consumer, typechecked, imported and run end to end in Node.                                                                                     | Bundlers other than the one used to build, Metro.                                   |
| Documentation             | Every TypeScript example, except a few marked as fragments, is typechecked against the built packages.                                                                                         | Whether an example's output matches its comment.                                    |

## Provider SDK versions

The contract files typecheck against exactly these versions:

| SDK                                  | Package                      | Version checked | Declared peer range |
| ------------------------------------ | ---------------------------- | --------------- | ------------------- |
| `@sentry/browser`                    | `flare-sentry`               | 10.75.0         | 8 to 10             |
| `@sentry/react-native`               | `flare-sentry`               | 8.27.0          | 6 to 8              |
| `@bugsnag/js`                        | `flare-bugsnag`              | 8.10.0          | 7.20 to 8           |
| `@bugsnag/react-native`              | `flare-bugsnag`              | 8.10.0          | 7.20 to 8           |
| `@react-native-firebase/crashlytics` | `flare-crashlytics`          | 26.4.0          | 22 to 26            |
| `posthog-js`                         | `flare-posthog`              | 1.434.2         | 1.434 to 1.x        |
| `posthog-react-native`               | `flare-posthog-react-native` | 4.75.0          | 4.75 to 4.x         |
| `@datadog/browser-rum`               | `flare-datadog`              | 7.13.0          | 7                   |
| `@datadog/mobile-react-native`       | `flare-datadog-react-native` | 3.7.0           | 3                   |
| `@datadog/browser-logs`              | `flare-datadog-logs`         | 7.13.0          | 7                   |
| `@opentelemetry/api-logs`            | `flare-opentelemetry`        | 0.222.0         | 0.200 to 0.x        |

The older versions inside each range have not been typechecked or run here. The range is a statement of intent. If you use one of them and an adapter misbehaves, that is a bug worth reporting.

## SDK behavior the adapters rely on

These were confirmed by reading the installed SDK source:

- Sentry's `withScope` forks the current scope. Sentry separately merges the isolation scope into each event, then runs the fork's event processors. The real SDK test covers this ordering because a single-scope fake cannot prove it.
- Bugsnag builds each event from a copy of the client state, and runs the `notify` completion callback with no error even when an `onError` callback discarded the event.
- Bugsnag's `clearMetadata` leaves an emptied section behind.
- React Native Firebase 26 exposes the modular API that the Crashlytics adapter calls.
- `@sentry/react-native` 8 has no `isInitialized`, and its `flush` takes no timeout. Its `withScope` logs an error thrown inside the callback and answers `undefined`, which the adapter reports as `failed`.
- posthog-js assigns a caller's properties over the exception's own, and merges them over its persisted properties and the distinct id on that event only. It attaches the exception steps it buffered only when the caller passes none, and clears them after a capture. The installed SDK test covers this.
- posthog-react-native defers a capture until the client has loaded its storage, and its distinct id is empty until then. A `$groups` property on a capture registers groups on the client itself.
- Datadog RUM merges its global context over an error's own attributes, skips the key `__proto__` at any depth, follows `cause` ten levels deep, and keeps up to 500 calls made before `init` in a buffer of its own.
- Datadog React Native flattens attributes into dot paths and drops every object that is neither a plain object nor an array, and the core builds sanitized data as plain objects and arrays. Before `initialize`, its calls wait in a bounded buffer and resolve at once.
- Datadog's browser Logs SDK merges a log's own context over the global context and the user, skips `__proto__` in that merge, follows `cause`, and logs "Empty message" for an error without one.
- OpenTelemetry's `@opentelemetry/sdk-logs` keeps at most 128 attributes per record by default, and cuts values only past an `attributeValueLengthLimit` you set. The installed SDK test covers the attributes a report uses.

Reading source is weaker than running it. A fake can share its author's misunderstanding of the SDK.

## Hydration

Every binding's status readers read `idle` on the server and until the component is mounted, so that server markup and the first client render agree. For React and Vue a test hydrates real server markup and asserts there is no mismatch. For Solid and Svelte the two halves are pinned separately, one test for what the server renders and one for the first value on the client, because their test setups compile a component for one side only.

## Never exercised

- No adapter has been run against its provider's real backend from this repository, and no log record was sent to an OpenTelemetry collector.
- Nothing has run on an iOS or Android device, in a simulator, in Hermes or in Expo.
- Only the example application has run in a real browser, in Chromium, and over simulated provider SDKs. The devtools' resizing and pointer dragging have not been exercised in a browser.
- No binding has run inside its meta-framework: Next.js, Nuxt, SolidStart or SvelteKit.
- Crashlytics' limits of 64 custom keys and 1024 characters per value come from Firebase's documentation. They have not been observed.
- The HTTP adapter has not been run against a production server.
- The Datadog browser SDK did not start inside jsdom, so no test runs it. Its fake rests on reading the source, as does the fake of `@datadog/browser-logs`, which has not run either.
- posthog-react-native and `@datadog/mobile-react-native` have never run: both need a React Native runtime.

## How the tests themselves were checked

Tests were written before the code and watched failing. After each milestone, the code was mutated on purpose, one change at a time, to confirm that a test fails for it. A mutation that survived led to a new test or exposed a bug. This found, among others, a cross-account leak through the ambient mirror of two adapters, which is now covered.

This process is not part of continuous integration. Continuous integration runs the type checks, the linters, the unit tests on two Node and React versions and on one version each of Vue, Solid and Svelte, the packed-consumer check and the documentation checks. The example's browser tests are not part of it.

## Checking it yourself

```sh
pnpm install
pnpm check
pnpm check:release
pnpm test:examples
```

The first command builds the packages and runs formatting, types, lint and the unit tests. The second adds the documentation checks, the packed-consumer check and the release metadata check. The third builds the packages and runs the example's browser tests in Chromium, through `@playwright/test`.
