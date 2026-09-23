# @priemskiyyy/flare-datadog-react-native

Send [Flare](../../core) exceptions to Datadog Real User Monitoring on React Native. You pass in the `DdRum` your application already set up, so this package imports no SDK. In the browser, use [`@priemskiyyy/flare-datadog`](../datadog).

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-datadog-react-native @datadog/mobile-react-native
```

## Create a Flare

Set up the SDK as Datadog describes, then pass `DdRum`:

```ts
import { DdRum } from "@datadog/mobile-react-native";
import { Flare } from "@priemskiyyy/flare";
import { datadog } from "@priemskiyyy/flare-datadog-react-native";

const flare = new Flare({
  destinations: { datadog: datadog({ sdk: DdRum }) },
});

flare.start();
flare.capture(new Error("Upload failed"), { tags: { area: "upload" } });
```

## Options

| Option | Default  | Meaning                                        |
| ------ | -------- | ---------------------------------------------- |
| `sdk`  | required | `DdRum`, from the SDK your application set up. |

There is no ambient option. See [below](#no-ambient-integration).

## Who a report belongs to

The SDK attaches the user your application set with `DdSdkReactNative.setUserInfo` to every error, and it does not reveal that user, so the account stands in for it. A report without a user is sent. A report whose account changed since it was captured, by a sign-out or a switch, is skipped as `identity-mismatch`, so it never lands on the next user. Any other report is sent, with `identity.user` listed as a loss, because the adapter cannot tell whether the user Datadog attaches is the report's own.

Give Flare and Datadog the same id, and change them together. The adapter never sets or clears Datadog's user.

## How a report is mapped

Each report is one RUM error, recorded at the time it was captured. Everything it carries beyond its message and stack trace travels under the `flare` attribute. The SDK flattens attributes into dot paths.

| Flare             | Datadog                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| exception         | `addError` with the message and the stack trace, whose header names it     |
| cause chain       | `flare.causes`, with each cause's name, message and stack                  |
| aggregated errors | `flare.aggregated`, with each error's name and message                     |
| message           | skipped as `unsupported-report-kind`, because RUM records errors           |
| `level`           | `flare.level`: a RUM error has no level of its own                         |
| `identity.user`   | the user the SDK attaches, as described above, and a loss                  |
| `tags`            | `flare.tags.<key>`                                                         |
| `contexts`        | `flare.contexts.<name>.<field>`                                            |
| `breadcrumbs`     | `flare.breadcrumbs`, each with its name, its data and its time in ISO form |
| `operation`       | `flare.operation`                                                          |
| report id         | `flare.report_id`, so the same report can be found in every destination    |

The SDK drops every object that is neither a plain object nor an array. The core builds sanitized data as plain objects and arrays, so contexts and breadcrumb data arrive intact.

## Behavior

- Versions: `@datadog/mobile-react-native` 3, an optional peer dependency, typed structurally through `DdRumLike`.
- Initialization is yours. Flare never initializes the SDK or sets its user. A call made before `DdSdkReactNative.initialize` waits in a bounded buffer of the SDK's own and is recorded once the SDK initializes.
- Evidence is `sdk-call-returned`, and there is no event id. The call settles once the SDK took the error, or buffered it, and its error event mapper can still discard it without saying so. A native call that rejects is a `failed` outcome.
- Automatic capture is Datadog's own. Crashes and errors the SDK collects itself never pass through Flare. Give each source one owner, or one error is reported twice.
- Privacy: what Flare submits was redacted, scrubbed and bounded by the core. What the SDK adds on its own, such as the view, the session, the device and your attributes, is outside that guarantee. Harden it with the error event mapper.
- Size: the SDK warns above 256 flattened attributes, and its backend may drop the rest.
- Flush: there is none, and `flare.flush()` reports `unsupported`. The native SDKs upload their batches on their own schedule.
- `native` is `DdRum`, fully typed, for everything Flare does not wrap, such as `addAction`. Calls made on it bypass Flare's routing, receipts and privacy.

## No ambient integration

The SDK merges its attributes and its user into every event, and nothing can take them back from one event. A mirror of Flare's session there would reach a report that waited in Flare's buffer while the account changed, and so describe someone else. The user and the attributes stay yours.

## Tests

Mapping and lifecycle tests use an in-process fake modelled on the source of `@datadog/mobile-react-native` 3.7, including its quirks: attributes flattened into dot paths, every object that is neither a plain object nor an array dropped, and a bounded buffer before initialization. A typecheck-only contract assigns the real `DdRum` to its structural type. The SDK never ran here, because it needs a device, and no error was sent to Datadog.

## License

[MIT](LICENSE)
