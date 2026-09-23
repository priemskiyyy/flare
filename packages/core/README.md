# @priemskiyyy/flare

Provider-independent error reporting for TypeScript, on the web and in React Native. The core owns how a report is built, isolated, sanitized, routed and handed to a destination. Adapters translate that report for Sentry, Bugsnag, Crashlytics, PostHog, Datadog, OpenTelemetry, your own backend or the console.

No dependencies, ESM only, no side effects on import.

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-console
```

## Use it

```ts
import { Flare } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";

export const flare = new Flare({
  destinations: { console: console() },
});

flare.start();
flare.user({ id: "user_42" });
flare.breadcrumb("checkoutOpened", { cartId });

try {
  await save();
} catch (error) {
  flare.capture(error, { tags: { area: "editor" } });
}
```

Creating a Flare starts nothing. `start()` opens the destinations, and a report captured before that waits in a bounded buffer. `capture()` is synchronous and never throws.

## The Flare

| Member                              | What it does                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `start()`                           | Opens every destination. A repeat retries only the ones that failed.                     |
| `capture(thrown, options?)`         | Reports a failure. Accepts anything that can be thrown.                                  |
| `message(text, options?)`           | Reports an abnormal condition that is not an exception.                                  |
| `user(user \| null)`                | Sets who is signed in. An id change clears session tags, contexts and breadcrumbs.       |
| `tag(key, value \| null)`           | Sets or removes a session tag.                                                           |
| `context(name, value \| null)`      | Sets or removes a session context. A context is replaced whole.                          |
| `breadcrumb(name, data?, options?)` | Records what happened before a failure.                                                  |
| `scope(options)`                    | Binds metadata to one unit of work. Goes stale when the account changes.                 |
| `flush({ timeout? })`               | Waits, bounded, for accepted work and for each provider's own flush. 2000 ms by default. |
| `destination(name)`                 | One destination's status and native SDK handle.                                          |
| `dispose()`                         | Releases every destination. Synchronous and idempotent.                                  |
| `status`, `diagnostics`             | Observable state. Reading them starts nothing and carries no report content.             |

## Options

Durations are in milliseconds.

| Option         | Default                             | Meaning                                                                                                                                                                                                  |
| -------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `destinations` | required                            | Named adapters. The names are typed everywhere.                                                                                                                                                          |
| `schema`       | none                                | Standard Schema validators for tags, contexts and breadcrumbs.                                                                                                                                           |
| `defaults`     | none                                | `to`, where a report goes: a list, or a function of `{ report }`, every destination if omitted. A report's own `to` replaces it. And `tags` and `contexts` every report carries, across account changes. |
| `privacy`      | `isSensitiveKey` and default limits | A `redact` predicate, a `scrub` function and size `limits`.                                                                                                                                              |
| `buffer`       | `{ capacity: 30, maxAge: 60000 }`   | Bounds of each destination's startup buffer.                                                                                                                                                             |
| `timeout`      | 5000                                | After this, a submission settles as `indeterminate`.                                                                                                                                                     |
| `dedupe`       | `{ window: 1000 }`                  | How long the same thrown object counts as a duplicate. `0` turns it off.                                                                                                                                 |
| `rateLimits`   | `{ perMinute: 120 }`                | The storm guard.                                                                                                                                                                                         |
| `now`          | `Date.now`                          | The clock, for tests.                                                                                                                                                                                    |

Misconfiguration throws a `FlareError` with the code `INVALID_CONFIGURATION`: from the constructor, for a count that is not a whole number of 0 or more, a duration outside 0 to 2147483647, a `defaults.to` list naming an unknown destination, a `redact` or `scrub` that is not a function, or `defaults` that fail the schema or cannot be sanitized, and from `destination()` for a name that was never configured. An option set to `undefined` keeps its default. Nothing on the reporting path throws.

## Other entries

**`@priemskiyyy/flare/mock`** is a deterministic adapter for your tests. It records every call and hands back the frozen report exactly as a destination received it, and it can hold, fail and delay on command.

```ts
import { Flare } from "@priemskiyyy/flare";
import { createMockAdapter } from "@priemskiyyy/flare/mock";

const mock = createMockAdapter();
const flare = new Flare({ destinations: { mock: mock.adapter } });

flare.start();

await flare.capture(new Error("boom")).settled;

console.log(mock.submissions[0]?.report.tags);
```

**`@priemskiyyy/flare/testing`** registers the contract every adapter must keep. It needs `vitest`, which is an optional peer for that reason.

The main entry also exports `FlareError`, the error Flare itself creates, with a `code` to branch on; `SanitizedError`, the `Error` an adapter builds from a sanitized report for an SDK that takes nothing else; `isSensitiveKey`, the default `redact`, to extend it; and every public type, `ReporterAdapter` among them.

## Documentation

- [Getting started](../../docs/getting-started.md), the [mental model](../../docs/mental-model.md) and [configuration](../../docs/configuration.md)
- [Capture and message](../../docs/capture-and-message.md), [tags, contexts, breadcrumbs](../../docs/metadata.md), [scopes](../../docs/scopes.md)
- [Users and account switching](../../docs/identity.md), [privacy and redaction](../../docs/privacy.md), [routing](../../docs/routing.md)
- [Receipts and evidence](../../docs/receipts.md), [flush and lifecycle](../../docs/flush.md)
- [Testing](../../docs/testing.md), [writing an adapter](../../docs/writing-an-adapter.md), the [architecture](../../docs/internals/architecture.md)

## Tests

The tests run over the mock adapter with an injected clock. They pin each invariant listed in the [architecture](../../docs/internals/architecture.md#invariants-and-their-tests), among them hostile thrown values, a scrubber that throws, concurrent reports for different accounts, an account switch while reports are buffered and in flight, late, duplicate and malformed provider answers, and disposal at every stage. Nothing here talks to a provider. See the [verification matrix](../../docs/verification.md).

## License

[MIT](LICENSE)
