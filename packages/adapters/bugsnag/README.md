# @priemskiyyy/flare-bugsnag

Send [Flare](../../core) error reports to Bugsnag, in the browser and in React Native. You inject the Bugsnag SDK your application already uses, so this package imports none, and a browser bundle can never pull in a React Native SDK.

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-bugsnag @bugsnag/js
```

On React Native, install `@bugsnag/react-native` instead of `@bugsnag/js`.

## Create a Flare

```ts
import Bugsnag, { Breadcrumb } from "@bugsnag/js";
import { Flare } from "@priemskiyyy/flare";
import { bugsnag } from "@priemskiyyy/flare-bugsnag";

Bugsnag.start({ apiKey: "0123456789abcdef0123456789abcdef" });

const flare = new Flare({
  destinations: { bugsnag: bugsnag({ sdk: Bugsnag, Breadcrumb }) },
});

flare.start();
flare.user({ id: "user_42" });
flare.capture(new Error("Upload failed"), { tags: { area: "upload" } });
```

On React Native the factory comes from its own entry, and everything else is the same:

```ts
import Bugsnag, { Breadcrumb } from "@bugsnag/react-native";
import { bugsnag } from "@priemskiyyy/flare-bugsnag/react-native";
```

## Options

| Option       | Default      | Meaning                                                                                                                      |
| ------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `sdk`        | required     | The static Bugsnag API: the default export of `@bugsnag/js` or `@bugsnag/react-native`.                                      |
| `Breadcrumb` | none         | Bugsnag's `Breadcrumb` class, a named export of the same package. Needed to write a report's breadcrumbs onto its own event. |
| `messages`   | `"skip"`     | `"skip"` leaves message reports out. `"as-error"` sends each one as an error named `Message`.                                |
| `ownership`  | `"borrowed"` | `"borrowed"`: your application starts Bugsnag, and Flare never does. `"owned"`: Flare starts it when the destination opens.  |
| `start`      | none         | Required with `ownership: "owned"`, for example `() => Bugsnag.start({ apiKey })`.                                           |
| `ambient`    | all off      | `{ user, tags, contexts, breadcrumbs }`. Mirrors those parts of Flare's session into the Bugsnag client. See below.          |

## How a report is mapped

Each report is written inside the `onError` callback of its own `Bugsnag.notify` call. Bugsnag builds that event from a copy of the client's user, metadata and breadcrumbs, so nothing a report carries reaches the client, and two reports can never share an event.

The adapter remembers which ambient sections were copied at submission time, including when an asynchronous application hook delays Flare's callback. If Flare's mapping fails, it explicitly discards the event and settles the receipt as `failed`; Bugsnag otherwise tolerates callback exceptions and continues sending.

| Flare             | Bugsnag                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| exception         | `notify` with an `Error` rebuilt from the sanitized name, message and stack                         |
| cause chain       | `cause` on the rebuilt errors, which Bugsnag reports as linked errors                               |
| aggregated errors | the metadata section `flare.aggregated`, because Bugsnag has no field for them                      |
| message           | skipped, or an error named `Message` with `messages: "as-error"`                                    |
| `level`           | `event.severity`. `fatal` is sent as `error`, and the level is kept in the `flare` metadata section |
| `identity.user`   | `event.setUser(id, email, name)`. Always written, cleared included                                  |
| `tags`            | the metadata section `tags`, because Bugsnag has no tags of its own                                 |
| `contexts`        | one metadata section per context, replaced by name and never merged                                 |
| `breadcrumbs`     | `Breadcrumb` instances added to `event.breadcrumbs`, in time order with Bugsnag's own               |
| `operation`       | `event.context`, Bugsnag's display context                                                          |
| report id         | `reportId` in the `flare` metadata section, so one report can be found in every destination         |

Bugsnag's `event.context` says what the user was doing, which is Flare's `operation`. Flare's structured contexts are a different thing and go to metadata.

The context names `tags`, `flare` and `flare.aggregated` are reserved for the adapter's metadata. They are omitted from reports and ambient mirroring, and each submitted report records an `unsupported` loss for a context using one of those names. Other context names are preserved.

Losses, recorded on the receipt:

- `level` when it is `fatal`, since Bugsnag has three severities.
- `breadcrumbs` when the report has some and the reporter was not given the `Breadcrumb` class. Mirroring cannot restore a report's capture-time history.
- `kind` for every message sent with `messages: "as-error"`, since it arrives as an error.

The `tags` and `flare` sections belong to Flare on the events it submits: a section is replaced as a whole, so keys your application keeps in a section of the same name do not appear on those events.

## Behavior

- Platforms and versions: the browser with `@bugsnag/js` 7.20 to 8, and React Native with `@bugsnag/react-native` 7.20 to 8. The SDK is an optional peer dependency and is typed structurally through `BugsnagLike`.
- Ownership: borrowed is the default and the recommended mode. `Bugsnag.notify` only logs when Bugsnag has not been started, and never calls back, so a borrowed SDK that is not started fails the destination's start with a named error. Call `flare.start()` again after `Bugsnag.start` and it succeeds, and reports captured meanwhile are delivered. Bugsnag cannot be stopped, so disposal releases nothing in either mode.
- Evidence is `sdk-callback-completed`. The post-report callback fires without an error for an event that was delivered, for one queued for later delivery, and also for one that an `onError` callback of your own discarded or that your release stage disabled. It cannot tell these apart, and neither can Flare, which is why `filtering` is `provider-hooks`. A callback with an error is a `failed` outcome. There is no event id.
- Messages: Bugsnag has no message events, so the default is to skip them rather than send a fake error silently. `messages: "as-error"` is an explicit opt-in to that lossy mapping.
- Automatic capture is Bugsnag's own. Unhandled errors, unhandled rejections and native crashes are captured by Bugsnag directly and never pass through Flare, and on React Native a JavaScript `onError` callback does not see every native error. To avoid reporting one JavaScript error twice, give each source one owner: report handled errors through Flare, and leave unhandled ones to Bugsnag.
- Privacy: what Flare submits was redacted, scrubbed and bounded by the core. What Bugsnag collects on its own, such as its automatic breadcrumbs, request and device data, is outside that guarantee. Harden it with Bugsnag's own options, such as `redactedKeys` and `collectUserIp: false`.
- Queue and offline: the browser notifier delivers at once and keeps nothing for later, so `queue` is `none`. On React Native the native layer stores events on the device and sends them later, so `queue` is `sdk-persistent`.
- There is no `flush` in either SDK. `flare.flush()` drains this destination and reports its boundary as `unsupported`.
- Bugsnag's static API is one process-wide instance. Registering the same SDK under two destination names is rejected when the `Flare` is constructed.
- `native` is the SDK you injected, fully typed, for everything Flare does not wrap, such as sessions or feature flags. Calls made on it bypass Flare's routing, receipts and privacy.

## Ambient integration

`ambient` mirrors the parts you enable into the Bugsnag client, so that events Bugsnag captures on its own carry them. It is off by default because isolation is weaker there: the client is shared by everything Bugsnag sends.

- Signing out, removing a tag and removing a context are mirrored. A context is replaced in the client as a whole. Tags are taken back key by key, so keys your application keeps in the `tags` section stay.
- Reports Flare submits never inherit what the mirror wrote. Bugsnag copies the client onto every event, and the mirrored state describes the current account, so the reporter clears those sections from each event before it writes the report's own. A report captured under one account and delivered after a switch therefore carries nothing of the next account.
- Bugsnag has no way to remove a breadcrumb from the client. Mirrored breadcrumbs are stamped under the key `flare.generation`. Each submitted event removes these mirrored entries and restores its captured history using the `Breadcrumb` class, while retaining Bugsnag's own entries. Without the class, Flare's entries are omitted and recorded as a loss.
- Events Bugsnag captures on its own keep mirrored breadcrumbs: after an account switch, a crash Bugsnag reports by itself can still show the previous account's entries. Leave breadcrumb mirroring off if that matters to you.
- Disposing takes back the user, tags and contexts Flare mirrored, and leaves what your application set itself.

## Tests

The tests run against an in-process fake SDK modelled on the installed client: `notify` copies the client onto the event, runs `onError` against the copy, and calls back afterwards, including for a discarded event. A typecheck-only contract file assigns the real `@bugsnag/js` and `@bugsnag/react-native` exports to the structural types, so a change in either SDK's signatures fails the build. No event is sent to Bugsnag, and nothing here runs on a device: stack parsing, grouping, delivery and the native layer are Bugsnag's and are not covered.

## License

[MIT](LICENSE)
