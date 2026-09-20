# @priemskiyyy/flare-crashlytics

Record [Flare](../../core) error reports as non-fatal errors in Firebase Crashlytics on React Native. You inject the React Native Firebase module your application already uses, so this package imports none.

Crashlytics can attach nothing to a single report from JavaScript. This reporter is deliberately limited to what is true: it records the error, lists everything else the report carried as a loss, and offers an opt-in ambient integration for the rest.

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-crashlytics @react-native-firebase/app @react-native-firebase/crashlytics
```

## Create a Flare

```ts
import { Flare } from "@priemskiyyy/flare";
import { crashlytics } from "@priemskiyyy/flare-crashlytics";
import * as Crashlytics from "@react-native-firebase/crashlytics";

const flare = new Flare({
  destinations: {
    crashlytics: crashlytics({
      sdk: Crashlytics,
      ambient: { user: true, tags: true },
    }),
  },
});

flare.start();
flare.user({ id: "user_42" });
flare.capture(new Error("Upload failed"));
```

## Options

| Option    | Default  | Meaning                                                                                                           |
| --------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `sdk`     | required | The `@react-native-firebase/crashlytics` module, passed as its namespace. The modular API of version 22 or newer. |
| `ambient` | all off  | `{ user, tags, contexts, breadcrumbs }`. The only way any of these reach Crashlytics. See below.                  |

There is no ownership option. Crashlytics is initialized by the native Firebase SDK, never from JavaScript, so Flare neither starts nor stops it.

## How a report is mapped

`recordError(crashlytics, error)` takes an Error and nothing else. There is no argument for a user, a key or a log line that belongs to one report.

| Flare           | Crashlytics                                                                       |
| --------------- | --------------------------------------------------------------------------------- |
| exception       | `recordError` with an `Error` rebuilt from the sanitized name, message and stack  |
| cause chain     | `cause` on the rebuilt errors                                                     |
| message         | skipped as `unsupported-report-kind`. Crashlytics records errors and nothing else |
| everything else | not sent with the report, and listed on the receipt as a loss                     |

Losses, each with the reason `unsupported`: `identity.user`, `tags`, `contexts`, `breadcrumbs`, `operation`, `exception.aggregated`, and `level` when it is not `error`, since whatever is recorded is a non-fatal. A report that carries none of these has no losses.

The reporter never sets the global user id or keys around a `recordError` call to imitate per-report data. That state is global, so it would leak into every other report and into crashes Crashlytics captures by itself. `capabilities.eventLocal` is `false` for all four fields, and the losses stay listed even with the ambient integration on, because what Crashlytics attaches then is its global state, not this report's.

## Ambient integration

`ambient` mirrors the parts you enable into Crashlytics' global state, which Crashlytics attaches to every non-fatal and every crash on its own.

| Part          | Crashlytics                                                                       |
| ------------- | --------------------------------------------------------------------------------- |
| `user`        | `setUserId` with the user's `id`. Email and name are not sent                     |
| `tags`        | custom keys, with each value as a string                                          |
| `contexts`    | custom keys named `context.key`, with a string as it is and anything else as JSON |
| `breadcrumbs` | `log`, one line per breadcrumb: the name, then its data as JSON                   |

Limits, which are Crashlytics' own:

- At most 64 custom keys. The reporter writes the first 64 distinct keys it is given, tags before contexts, and ignores the rest.
- A key cannot be deleted. A removed tag or context is written as an empty string, and it keeps its slot among the 64.
- A value, and a log line, is cut at 1024 characters.
- The user id cannot be cleared. Signing out writes an empty string.
- Log lines cannot be cleared. Crashlytics keeps a rolling buffer of about 64 kB, so after an account switch a crash can still show lines logged under the previous account. Leave `breadcrumbs` off if that matters to you.

These limits were checked against the installed type declarations and Firebase's documentation, not on a device. The Android documentation states 64 key-value pairs of up to 1 kB each; verify the behavior of your platform and SDK version before relying on a limit.

An account change blanks every key the previous account left, because the core clears session tags and contexts when the identity changes. Disposing blanks the user id and every key Flare wrote, and leaves what your application set itself.

With `user` on, Crashlytics attaches the mirrored user id to every non-fatal natively. A report that belongs to someone else, such as one captured under a previous account and delivered after a switch, or one given its own `user`, would be recorded under the wrong account. The reporter skips it as `identity-mismatch` instead. Without `user` on, Flare wrote no user id, and every report is recorded.

## Behavior

- Platforms and versions: React Native on iOS and Android, with `@react-native-firebase/crashlytics` 22 to 26. There is no web SDK. The module is an optional peer dependency and is typed structurally through `CrashlyticsLike`.
- Evidence is `sdk-call-returned`: `recordError` returned. There is no event id and no callback.
- Queue and offline: a non-fatal is stored on the device and usually sent the next time the application starts. `queue` is `sdk-persistent`, and retry belongs to Crashlytics.
- There is no `flush`. `sendUnsentReports` enqueues reports for upload when automatic collection is disabled and acknowledges nothing, so it is not a flush, and the reporter does not call it. `flare.flush()` reports this destination as `unsupported`.
- Collection is opt-in capable: with `setCrashlyticsCollectionEnabled(false)`, nothing recorded is ever sent, and the receipt cannot know. That is why `filtering` is `provider-hooks`.
- Automatic capture is Crashlytics' own. Native crashes, and the unhandled JavaScript errors React Native Firebase reports by itself, never pass through Flare. To avoid reporting one JavaScript error twice, give each source one owner.
- Privacy: the Error Flare hands over was rebuilt from the redacted report, and mirrored values were redacted, scrubbed and bounded by the core. What Crashlytics collects on its own, such as device state and Analytics breadcrumbs, is outside that guarantee.
- The Crashlytics module is one process-wide instance. Registering it under two destination names is rejected when the `Flare` is constructed.
- `native` is the Crashlytics instance from `getCrashlytics()`, obtained when the destination opens, for everything Flare does not wrap, such as `setCrashlyticsCollectionEnabled`.

## Tests

The tests run against an in-process fake of the modular API that models the one fact this reporter is built around: `recordError` attaches whatever is global at that moment. A typecheck-only contract file assigns the real `@react-native-firebase/crashlytics` module to `CrashlyticsLike`, so a change in its signatures fails the build. Nothing here runs on a device or reaches Firebase: on-device storage, upload, the key and log limits, and symbolication are Crashlytics' and are not covered.

## License

[MIT](LICENSE)
