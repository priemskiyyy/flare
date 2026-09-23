# @priemskiyyy/flare-sentry

Send [Flare](../../core) error reports to Sentry, in the browser and in React Native. You pass in the Sentry SDK your application already initialized, so this package imports none, and a browser bundle can never pull in a React Native SDK.

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-sentry @sentry/browser
```

On React Native, install `@sentry/react-native` instead of `@sentry/browser`.

## Create a Flare

```ts
import { Flare } from "@priemskiyyy/flare";
import { sentry } from "@priemskiyyy/flare-sentry";
import * as Sentry from "@sentry/browser";

Sentry.init({ dsn: "https://key@example.ingest.sentry.io/1" });

const flare = new Flare({
  destinations: { sentry: sentry({ sdk: Sentry }) },
});

flare.start();
flare.user({ id: "user_42" });
flare.capture(new Error("Upload failed"), { tags: { area: "upload" } });
```

On React Native, pass `@sentry/react-native` instead. The adapter and everything else are the same:

```ts
import { sentry } from "@priemskiyyy/flare-sentry";
import * as Sentry from "@sentry/react-native";
```

## Options

| Option    | Default  | Meaning                                                                                                                                             |
| --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sdk`     | required | The Sentry SDK your application initialized, passed as its module namespace. `@sentry/browser`, `@sentry/react` and `@sentry/react-native` all fit. |
| `ambient` | all off  | `{ user, tags, contexts, breadcrumbs }`. Mirrors those parts of Flare's session into Sentry's global scope. See below.                              |

## How a report is mapped

Each report registers an event processor inside `Sentry.withScope`. The processor runs after Sentry combines its global, isolation and current scopes, and replaces Flare's fields with the captured report. Nothing a report carries reaches shared scope state.

| Flare             | Sentry                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------- |
| exception         | `captureException` with an `Error` rebuilt from the sanitized name, message and stack         |
| cause chain       | `cause` on the rebuilt errors, which Sentry's linked errors integration follows               |
| aggregated errors | the context `flare.aggregated`, because Sentry has no field for them                          |
| message           | `captureMessage`, never a fake exception                                                      |
| `level`           | `event.level`, with the same four names                                                       |
| `identity.user`   | `event.user`, with `name` as `username`; an anonymous report replaces the user with `{}`      |
| `tags`            | `event.tags`, plus `flare.report_id` so the same report can be found in every destination     |
| `contexts`        | `event.contexts`, replacing each report context by name                                       |
| `breadcrumbs`     | `event.breadcrumbs` with category `flare`, the name as message, and time converted to seconds |
| `operation`       | `event.transaction`                                                                           |

Losses: a tag whose key is longer than 32 characters or whose value is longer than 200 is reported as `truncated`, since Sentry cuts or refuses it. The tag `flare.report_id` is owned by the adapter; a supplied value is replaced and reported as `unsupported`. An aggregate error also replaces a supplied `flare.aggregated` context and records that loss.

The user is replaced as a whole. A report Flare considers anonymous, for example one captured after `flare.user(null)`, therefore never inherits a user that is still on Sentry's scopes. A report with only an ID cannot inherit another user's email. Set the user through Flare.

## Behavior

- Platforms and versions: the browser with `@sentry/browser` or `@sentry/react` 8 to 10, and React Native with `@sentry/react-native` 6 to 8. The SDK is an optional peer dependency and is typed structurally through `SentryLike`.
- Initialization is yours. Flare never initializes or closes Sentry. An SDK that is not initialized yet fails the destination's start with a `FlareError` whose code is `NOT_INITIALIZED`; call `flare.start()` again after `Sentry.init` and it succeeds, and the reports captured meanwhile are delivered while they are still in Flare's buffer.
- Evidence is `sdk-call-returned`. Sentry hands out an event id before sampling, `beforeSend` and rate limits run, so the id proves the call returned and nothing more. A `submitted` outcome does not mean Sentry kept the event.
- On React Native, `Sentry.withScope` logs an error thrown inside it and answers `undefined`. A capture that failed there is therefore `failed`, with a `FlareError` whose code is `SUBMISSION_FAILED`, because the SDK has already consumed its own error.
- Automatic capture is Sentry's own. Unhandled errors, unhandled rejections and native crashes are captured by Sentry directly and never pass through Flare, so they carry only what is on Sentry's global scope. To avoid reporting one JavaScript error twice, give each source one owner: report handled errors through Flare, and leave unhandled ones to Sentry.
- Privacy: what Flare submits was redacted, scrubbed and bounded by the core. What Sentry collects on its own, such as its automatic breadcrumbs, request data and native context, is outside that guarantee. Harden it with Sentry's own options, such as `sendDefaultPii: false` and `beforeSend`.
- Queue and offline: in the browser Sentry keeps events in memory, and events that have not left when the page closes are gone. On React Native the native SDK stores events on the device and sends them later, even after a restart. Once a report is handed over, retry belongs to Sentry.
- Flush: in the browser `flush` waits for Sentry's in-memory transport queue. On React Native `Sentry.flush()` takes no timeout and resolves when events have been handed to the native SDK. Flare bounds the wait either way, and a timeout proves nothing about delivery.
- Sentry is one process-wide instance. Register it under one destination name: two destinations over the same SDK report every event twice.
- `native` is the SDK you passed in, fully typed, for everything Flare does not wrap, such as `getReplay` or `nativeCrash`. Calls made on it bypass Flare's routing, receipts and privacy.

## Ambient integration

`ambient` mirrors the parts you enable into Sentry's global scope, so that events Sentry captures on its own carry them. It is off by default because isolation is weaker there: the global scope is shared by everything Sentry sends.

- Signing out, removing a tag and removing a context are mirrored, so the global scope stops naming the previous account.
- Reports Flare submits replace mirrored tags and contexts after Sentry combines its scopes. A report captured under one account and delivered after a switch therefore carries none of the next account's mirrored metadata.
- Mirrored breadcrumbs go into the list Sentry keeps its own automatic breadcrumbs in. When the account changes, that whole list is cleared, Sentry's own entries included. Each submitted event replaces Flare's entries with its capture-time snapshot, including breadcrumbs recorded before startup, and retains Sentry's own entries.
- Disposing takes back the user, tags and contexts Flare mirrored, and leaves what your application set itself. Mirrored breadcrumbs stay, because that list is not Flare's alone.

## Tests

Mapping and lifecycle tests use an in-process fake. An integration test runs the installed `@sentry/browser` SDK through `beforeSend` to verify buffered reports across an account switch, including actual scope composition. It discards the event before transport. A typecheck-only contract assigns the real browser and React Native SDKs to `SentryLike`. No event is sent to Sentry, and nothing here runs on a device: symbolication, delivery and the native layer are not covered.

## License

[MIT](LICENSE)
