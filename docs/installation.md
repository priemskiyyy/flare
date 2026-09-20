---
description: "Every Flare package, what it needs, and which provider SDK versions each adapter is written against."
---

# Installation

Every package is ESM only, has no side effects on import, and ships its own type declarations. The core has no dependencies.

```sh
pnpm add @priemskiyyy/flare
```

## Packages

| Package                          | What it is                                                                              | Needs                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `@priemskiyyy/flare`             | The runtime, plus `./mock` and `./testing`                                              | nothing                                                                                |
| `@priemskiyyy/flare-react`       | Provider, status hooks and an error boundary                                            | `react` 19.2 or newer                                                                  |
| `@priemskiyyy/flare-vue`         | Provider, status composables and an error boundary                                      | `vue` 3.5 or newer                                                                     |
| `@priemskiyyy/flare-solid`       | Provider, status primitives and an error boundary                                       | `solid-js` 1.9 or newer                                                                |
| `@priemskiyyy/flare-svelte`      | Provider, status utilities and an error boundary                                        | `svelte` 5.7 or newer                                                                  |
| `@priemskiyyy/flare-devtools`    | The in-page inspector, plus wrappers under `./react`, `./vue`, `./solid` and `./svelte` | nothing, or the binding of the wrapper you use. The Svelte wrapper needs `svelte` 5.29 |
| `@priemskiyyy/flare-console`     | Prints reports, for development                                                         | nothing                                                                                |
| `@priemskiyyy/flare-http`        | Posts reports to your own backend                                                       | a `fetch`                                                                              |
| `@priemskiyyy/flare-sentry`      | Sentry, for the browser and under `./react-native`                                      | `@sentry/browser` 8 to 10, or `@sentry/react-native` 6 to 8                            |
| `@priemskiyyy/flare-bugsnag`     | Bugsnag, for the browser and under `./react-native`                                     | `@bugsnag/js` or `@bugsnag/react-native` 7.20 to 8                                     |
| `@priemskiyyy/flare-crashlytics` | Firebase Crashlytics, for React Native                                                  | `@react-native-firebase/crashlytics` 22 to 26                                          |
| `@priemskiyyy/flare-trace`       | Turns selected Trace events into breadcrumbs                                            | nothing                                                                                |

Every package that builds on the core declares it as a peer dependency, so an application always has exactly one copy of it.

## Provider SDKs are yours

An adapter never imports its provider SDK. You install the SDK your application already uses and pass it in:

```ts
import { sentry } from "@priemskiyyy/flare-sentry";
import * as Sentry from "@sentry/browser";

const destination = sentry({ sdk: Sentry });
```

That is why the provider SDKs are optional peer dependencies, and why installing `@priemskiyyy/flare-sentry` in a web application can never bring in a React Native package.

## Runtime requirements

The packages target ES2022 and use no Node-only API, so they load in browsers, in React Native with Hermes, in Node and in edge runtimes. Continuous integration runs the test suite on Node 22 and Node 24. Report ids use `crypto.randomUUID` where it exists and fall back to `Math.random` where it does not, as in Hermes: an id is an idempotency key, not a secret.

## Typed schemas

Typing your tags, contexts and breadcrumbs needs a validator that implements [Standard Schema](https://standardschema.dev), such as Zod, Valibot or ArkType. The core depends on none of them. See [tags, contexts, breadcrumbs](metadata.md).
