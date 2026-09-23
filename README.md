# Flare

**Provider-independent error reporting for TypeScript, on the web and in React Native.**

Report errors through one small API. Configuration decides whether they go to Sentry, Bugsnag, Crashlytics, PostHog, Datadog, OpenTelemetry, your own backend, the console, or several of them at once.

```ts
import { Flare } from "@priemskiyyy/flare";
import { http } from "@priemskiyyy/flare-http";
import { sentry } from "@priemskiyyy/flare-sentry";
import * as Sentry from "@sentry/browser";

Sentry.init({ dsn });

export const flare = new Flare({
  destinations: {
    sentry: sentry({ sdk: Sentry }),
    // Your own API client sends each report to your backend.
    backend: http({ request: sendReport }),
  },
});

flare.start();
flare.user({ id: "user_42" });

try {
  await save();
} catch (error) {
  flare.capture(error, { tags: { area: "editor" } });
}
```

## Why not call the provider SDK directly

Renaming `captureException` would not be worth a library. Flare owns what surrounds the call:

- **Isolation.** A report's user, tags and contexts are written to that one event. They never reach a provider's global state, so they never appear on another report.
- **Account boundaries.** Changing the user clears the previous account's tags, contexts and breadcrumbs. Work that outlives the switch cannot blame the new account.
- **Privacy first.** Redaction, scrubbing and size bounds run before anything is kept, buffered, observed or sent. A redactor or scrubber that fails drops the data instead of sending it.
- **Typed routing.** Destinations have names, names are typed, and a broken routing rule drops the report instead of widening its audience.
- **Honest receipts.** Every report says what happened at each destination and on what evidence. An SDK call that returned is reported as exactly that, not as delivery.
- **No lock-in, no bundling.** Adapters import no provider SDK. You pass in the one you already use.

Flare guarantees how a report is constructed, isolated, sanitized, routed and handed to a destination. It does not claim that a provider stored, processed or displayed a report, unless that destination gives evidence for that exact boundary.

It does not replace native crash detection, source maps, grouping, tracing, session replay or dashboards. Your provider keeps doing those. It is also not a logger.

## Packages

| Package                                                                             | What it is                                             |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [`@priemskiyyy/flare`](packages/core)                                               | The runtime, the mock adapter and the adapter test kit |
| [`@priemskiyyy/flare-react`](packages/react)                                        | Provider, status hooks and an error boundary           |
| [`@priemskiyyy/flare-vue`](packages/vue)                                            | The same for Vue                                       |
| [`@priemskiyyy/flare-solid`](packages/solid)                                        | The same for Solid                                     |
| [`@priemskiyyy/flare-svelte`](packages/svelte)                                      | The same for Svelte 5                                  |
| [`@priemskiyyy/flare-devtools`](packages/devtools)                                  | In-page inspector, with a wrapper for each binding     |
| [`@priemskiyyy/flare-sentry`](packages/adapters/sentry)                             | Sentry, browser and React Native                       |
| [`@priemskiyyy/flare-bugsnag`](packages/adapters/bugsnag)                           | Bugsnag, browser and React Native                      |
| [`@priemskiyyy/flare-crashlytics`](packages/adapters/crashlytics)                   | Firebase Crashlytics, React Native                     |
| [`@priemskiyyy/flare-posthog`](packages/adapters/posthog)                           | PostHog error tracking, browser                        |
| [`@priemskiyyy/flare-posthog-react-native`](packages/adapters/posthog-react-native) | PostHog error tracking, React Native                   |
| [`@priemskiyyy/flare-datadog`](packages/adapters/datadog)                           | Datadog RUM, browser                                   |
| [`@priemskiyyy/flare-datadog-react-native`](packages/adapters/datadog-react-native) | Datadog RUM, React Native                              |
| [`@priemskiyyy/flare-datadog-logs`](packages/adapters/datadog-logs)                 | Datadog Logs, browser, messages included               |
| [`@priemskiyyy/flare-opentelemetry`](packages/adapters/opentelemetry)               | OpenTelemetry log records, to any OTLP backend         |
| [`@priemskiyyy/flare-http`](packages/adapters/http)                                 | Your own backend                                       |
| [`@priemskiyyy/flare-console`](packages/adapters/console)                           | The console, for development                           |
| [`@priemskiyyy/flare-trace`](packages/trace)                                        | Selected Trace events as breadcrumbs                   |

Every package is ESM only, side-effect free and typed. The core has no dependencies.

## Documentation

- [Getting started](docs/getting-started.md), the [mental model](docs/mental-model.md) and [configuration](docs/configuration.md)
- [Users and account switching](docs/identity.md), [privacy and redaction](docs/privacy.md), [routing](docs/routing.md)
- [Receipts and evidence](docs/receipts.md), [flush and lifecycle](docs/flush.md)
- [Choose an adapter](docs/adapters.md) and [provider limitations](docs/provider-limitations.md)
- [React](docs/react.md), [Vue](docs/vue.md), [Solid](docs/solid.md), [Svelte](docs/svelte.md), [React Native and Expo](docs/react-native.md), [server rendering](docs/server-rendering.md)
- [Testing](docs/testing.md), [devtools](docs/devtools.md), [troubleshooting](docs/troubleshooting.md)
- [Writing an adapter](docs/writing-an-adapter.md) and the [architecture](docs/internals/architecture.md)

[Ledger](docs/examples.md), a runnable React example, shows where each report goes and needs no provider account.

## Status

Nothing is published yet, and the API may still change before the first release.

The adapters are tested against fakes that are typechecked against the real provider SDKs. None has been run against a provider's real backend or on a device from this repository. The [verification matrix](docs/verification.md) says exactly what has been exercised and what has not.

## Development

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm check:release
```

`pnpm check` builds every package, then runs the TypeScript, ESLint and Prettier checks and the unit tests. `pnpm check:release` adds the documentation checks and installs the packed tarballs into a clean consumer. See [CONTRIBUTING.md](CONTRIBUTING.md) for the layout and the code rules, [SUPPORT.md](SUPPORT.md) for what a bug report needs, and [RELEASING.md](RELEASING.md) for publication.

## License

[MIT](LICENSE)
