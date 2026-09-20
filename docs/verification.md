---
description: "Exactly what Flare's test suite proves and what it does not: which behavior runs against fakes, which against real SDK types, and what has never run on a device or against a real backend."
---

# Verification matrix

A library about honest receipts should be honest about its own evidence. This page says what has been exercised and how, and what has not.

## How each layer is tested

| Layer               | How it is tested                                                                                                                              | What that does not cover                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Core                | Unit tests over the mock adapter, with an injected clock and fake timers.                                                                     | Real timers under load, real memory pressure.                                                                                     |
| Provider adapters   | Unit tests over an in-process fake of each SDK, plus a shared conformance suite.                                                              | Provider backends and native SDK behavior.                                                                                        |
| Sentry composition  | The installed browser SDK runs in Node through `beforeSend`, verifying identity and breadcrumbs on a buffered report after an account switch. | Browser integrations, transport, sampling, symbolication and native scope behavior.                                               |
| Provider SDK typing | A typecheck-only contract file per adapter assigns the real SDK to the adapter's structural type.                                             | SDK versions other than the ones installed here.                                                                                  |
| HTTP adapter        | Unit tests over an in-process fake `fetch` that behaves like a backend.                                                                       | A real network, proxies, CORS, a real server.                                                                                     |
| React bindings      | Real React with Testing Library in jsdom, including Strict Mode, server render and hydration.                                                 | A real browser, React Native's renderer.                                                                                          |
| Vue bindings        | Real Vue with Vue Test Utils in jsdom, a server render in Node, and hydration of that server markup.                                          | A real browser, Nuxt.                                                                                                             |
| Solid bindings      | Real Solid with Solid Testing Library in jsdom, and a server render in Node.                                                                  | Hydration itself, a real browser, SolidStart.                                                                                     |
| Svelte bindings     | Real Svelte 5 with Svelte Testing Library in jsdom, a server render in Node, and `svelte-check`.                                              | Hydration itself, a real browser, SvelteKit.                                                                                      |
| Devtools            | A real shadow root in jsdom, queried by role, and each wrapper rendered through its own binding.                                              | Layout, styling, pointer dragging and focus behavior in a real browser. Nobody has looked at it on a screen from this repository. |
| Trace bridge        | Unit tests over a fake event source.                                                                                                          | A real Trace, which is not released.                                                                                              |
| Published packages  | The packed tarballs are installed into a clean consumer, typechecked, imported and run end to end in Node.                                    | Bundlers other than the one used to build, Metro.                                                                                 |
| Documentation       | Every TypeScript example is typechecked against the built packages.                                                                           | Whether an example's output matches its comment.                                                                                  |

## Provider SDK versions

The contract files typecheck against exactly these versions:

| SDK                                  | Version checked | Declared peer range |
| ------------------------------------ | --------------- | ------------------- |
| `@sentry/browser`                    | 10.75.0         | 8 to 10             |
| `@sentry/react-native`               | 8.27.0          | 6 to 8              |
| `@bugsnag/js`                        | 8.10.0          | 7.20 to 8           |
| `@bugsnag/react-native`              | 8.10.0          | 7.20 to 8           |
| `@react-native-firebase/crashlytics` | 26.4.0          | 22 to 26            |

The older versions inside each range have not been typechecked or run here. The range is a statement of intent. If you use one of them and an adapter misbehaves, that is a bug worth reporting.

## SDK behavior the adapters rely on

These were confirmed by reading the installed SDK source:

- Sentry's `withScope` forks the current scope. Sentry separately merges the isolation scope into each event, then runs the fork's event processors. The real SDK test covers this ordering because a single-scope fake cannot prove it.
- Bugsnag builds each event from a copy of the client state, and runs the `notify` completion callback with no error even when an `onError` callback discarded the event.
- Bugsnag's `clearMetadata` leaves an emptied section behind.
- React Native Firebase 26 exposes the modular API that the Crashlytics adapter calls.
- `@sentry/react-native` 8 has no `isInitialized`, and its `flush` takes no timeout.

Reading source is weaker than running it. A fake can share its author's misunderstanding of the SDK.

## Hydration

Every binding's status readers read `idle` on the server and until the component is mounted, so that server markup and the first client render agree. For React and Vue a test hydrates real server markup and asserts there is no mismatch. For Solid and Svelte the two halves are pinned separately, one test for what the server renders and one for the first value on the client, because their test setups compile a component for one side only.

## Never exercised

- No adapter has been run against its provider's real backend from this repository.
- Nothing has run on an iOS or Android device, in a simulator, in Hermes or in Expo.
- Nothing has run in a real browser. There are no end-to-end browser tests, and the devtools panel has not been looked at on a screen.
- No binding has run inside its meta-framework: Next.js, Nuxt, SolidStart or SvelteKit.
- Crashlytics' limits of 64 custom keys and 1024 characters per value come from Firebase's documentation. They have not been observed.
- The HTTP adapter has not been run against a production server.

## How the tests themselves were checked

Tests were written before the code and watched failing. After each milestone, the code was mutated on purpose, one change at a time, to confirm that a test fails for it. A mutation that survived led to a new test or exposed a bug. This found, among others, a cross-account leak through the ambient mirror of two adapters, which is now covered.

This process is not part of continuous integration. Continuous integration runs the type checks, the linters, the unit tests on two Node and React versions and on one version each of Vue, Solid and Svelte, the packed-consumer check and the documentation checks.

## Checking it yourself

```sh
pnpm install
pnpm check
pnpm check:release
```

The first command runs formatting, types, lint and the unit tests. The second adds the packed-consumer check and the documentation checks.
