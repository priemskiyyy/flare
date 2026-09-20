# @priemskiyyy/flare

Provider-independent error reporting for TypeScript, on the web and in React Native. The core owns how a report is built, isolated, sanitized, routed and handed to a destination. Adapters translate that report for Sentry, Bugsnag, Crashlytics, an HTTP endpoint or the console.

No dependencies, ESM only, no side effects on import.

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-console
```

## Use it

```ts
import { Flare } from "@priemskiyyy/flare";
import { consoleReporter } from "@priemskiyyy/flare-console";

export const flare = new Flare({
  destinations: { console: consoleReporter() },
});

flare.start();
flare.user({ id: "user_42" });
flare.breadcrumb("checkoutOpened", { cartId });

try {
  await save();
} catch (error) {
  const receipt = flare.capture(error, { tags: { area: "editor" } });
  console.log(await receipt.settled);
}
```

Creating a Flare starts nothing. `start()` opens the destinations, and a report captured before that waits in a bounded buffer. `capture()` is synchronous and never throws.

## The Flare

| Member                              | What it does                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `start()`                           | Opens every destination. A repeat retries only the ones that failed.               |
| `capture(thrown, options?)`         | Reports a failure. Accepts anything that can be thrown.                            |
| `message(text, options?)`           | Reports an abnormal condition that is not an exception.                            |
| `user(user \| null)`                | Sets who is signed in. An id change clears session tags, contexts and breadcrumbs. |
| `tag(key, value \| null)`           | Sets or removes a session tag.                                                     |
| `context(name, value \| null)`      | Sets or removes a session context. A context is replaced whole.                    |
| `breadcrumb(name, data?, options?)` | Records what happened before a failure.                                            |
| `scope(options)`                    | Binds metadata to one unit of work. Goes stale when the account changes.           |
| `flush({ timeoutMs? })`             | Waits, bounded, for accepted work and for each provider's own flush.               |
| `destination(name)`                 | One destination's status, capabilities and native SDK handle.                      |
| `dispose()`                         | Releases every destination. Synchronous and idempotent.                            |
| `status`, `diagnostics`             | Observable state. Reading them starts nothing and carries no report content.       |

## Options

| Option         | Default                      | Meaning                                                                                           |
| -------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `destinations` | required                     | Named adapters. The names are typed everywhere.                                                   |
| `default`      | every destination            | Where a report goes when nothing else says.                                                       |
| `route`        | none                         | Decides per report. Mutually exclusive with `default`. Fails closed.                              |
| `schema`       | none                         | Standard Schema validators for tags, contexts and breadcrumbs.                                    |
| `defaults`     | none                         | Tags and contexts every report carries, across account changes.                                   |
| `privacy`      | default redaction and limits | `redact` rules, a `scrub` function and size `limits`.                                             |
| `buffer`       | 30 reports, 60 seconds       | Bounds of each destination's startup buffer.                                                      |
| `deadlineMs`   | 5000                         | After this, a submission settles as `indeterminate`.                                              |
| `dedupe`       | 1 second, 100 keys           | The same-object window and remembered keys per destination. History resets on an identity change. |
| `limits`       | 120 reports a minute         | The storm guard.                                                                                  |
| `now`          | `Date.now`                   | The clock, for tests.                                                                             |

Misconfiguration throws from the constructor. Nothing on the reporting path throws.

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

The main entry also exports `createReporterAdapter` and `rebuildError` for adapter authors, `DEFAULT_REDACT` to extend the default redaction rules, and every public type.

## Documentation

- [Getting started](../../docs/getting-started.md) and the [mental model](../../docs/mental-model.md)
- [Capture and message](../../docs/capture-and-message.md), [tags, contexts, breadcrumbs](../../docs/metadata.md), [scopes](../../docs/scopes.md)
- [Users and account switching](../../docs/identity.md), [privacy and redaction](../../docs/privacy.md), [routing](../../docs/routing.md)
- [Receipts and evidence](../../docs/receipts.md), [flush and lifecycle](../../docs/flush.md)
- [Testing](../../docs/testing.md), [writing an adapter](../../docs/writing-an-adapter.md), the [architecture](../../docs/internals/architecture.md)

## Tests

The tests run over the mock adapter with an injected clock. They cover the 28 edge cases of the specification, among them hostile thrown values, a scrubber that throws, concurrent reports for different accounts, an account switch while reports are buffered and in flight, late and duplicate provider answers, and disposal at every stage. Nothing here talks to a provider. See the [verification matrix](../../docs/verification.md).

## License

[MIT](LICENSE)
