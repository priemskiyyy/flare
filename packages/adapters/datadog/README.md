# @priemskiyyy/flare-datadog

Send [Flare](../../core) exceptions to Datadog Real User Monitoring in the browser. You pass in the `datadogRum` your application already initialized, so this package imports no SDK. On React Native, use [`@priemskiyyy/flare-datadog-react-native`](../datadog-react-native). For logs, messages included, use [`@priemskiyyy/flare-datadog-logs`](../datadog-logs).

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-datadog @datadog/browser-rum
```

## Create a Flare

```ts
import { datadogRum } from "@datadog/browser-rum";
import { Flare } from "@priemskiyyy/flare";
import { datadog } from "@priemskiyyy/flare-datadog";

datadogRum.init({
  applicationId: "00000000-0000-0000-0000-000000000000",
  clientToken: "pub00000000000000000000000000000000",
  site: "datadoghq.eu",
});

const flare = new Flare({
  destinations: { datadog: datadog({ sdk: datadogRum }) },
});

flare.start();
datadogRum.setUser({ id: "user_42" });
flare.user({ id: "user_42" });
flare.capture(new Error("Upload failed"), { tags: { area: "upload" } });
```

## Options

| Option | Default  | Meaning                                           |
| ------ | -------- | ------------------------------------------------- |
| `sdk`  | required | `datadogRum`, which your application initialized. |

There is no ambient option. See [below](#no-ambient-integration).

## Who a report belongs to

RUM attaches its current user to every event when it assembles it: the user your application set with `datadogRum.setUser`. Nothing can attach another user to one error. A report without a user is sent under whoever that is. A report with a user is sent only when Datadog's user has that user's `id`. Otherwise it is skipped as `identity-mismatch`: a report captured before an account switch, or captured on behalf of another user, never lands on the wrong user.

Give Flare and Datadog the same id, and change them together. The adapter never sets or clears Datadog's user.

## How a report is mapped

Each report is one RUM error. Everything it carries beyond the error travels under `flare`, one attribute of that error's own context. RUM merges its global context over an error's attributes when it assembles the event, so data at the top of the context would lose to your global context of the same name. Under `flare`, only that one name is shared: keep it for Flare.

| Flare             | Datadog                                                                       |
| ----------------- | ----------------------------------------------------------------------------- |
| exception         | `addError` with an `Error` rebuilt from the sanitized name, message and stack |
| cause chain       | `cause` on the rebuilt errors, which RUM follows into the error's causes      |
| aggregated errors | `flare.aggregated`, with each error's name and message                        |
| message           | skipped as `unsupported-report-kind`, because RUM records errors              |
| `level`           | `flare.level`: a RUM error has no level of its own                            |
| `identity.user`   | the user RUM attaches, as described above                                     |
| `tags`            | `flare.tags`                                                                  |
| `contexts`        | `flare.contexts`                                                              |
| `breadcrumbs`     | `flare.breadcrumbs`, each with its name, its data and its time in ISO form    |
| `operation`       | `flare.operation`                                                             |
| report id         | `flare.report_id`, so the same report can be found in every destination       |
| time              | when the report is submitted                                                  |

Losses, each `unsupported`: a tag or context named `__proto__`, which Datadog's merge skips.

## Behavior

- Versions: `@datadog/browser-rum` 7, an optional peer dependency, typed structurally through `DatadogRumLike`.
- Initialization is yours. Flare never initializes Datadog or sets its user. RUM that `datadogRum.init` has not run on fails the destination's start with a `FlareError` whose code is `NOT_INITIALIZED`: until `init`, RUM keeps errors in a buffer of its own and sends them only if `init` ever runs. Call `flare.start()` again after `init` and it succeeds, and the reports captured meanwhile are delivered while they are still in Flare's buffer.
- Evidence is `sdk-call-returned`, and there is no event id. `addError` answers nothing, and sampling, `beforeSend` and rate limits discard an error after it returns without saying so. `submitted` does not mean Datadog kept the error.
- Automatic capture is Datadog's own. Unhandled errors, console errors and crashes that Datadog collects itself never pass through Flare. To avoid reporting one error twice, give each source one owner.
- Privacy: what Flare submits was redacted, scrubbed and bounded by the core. What RUM adds on its own, such as the view, the session, the device, your global context and your user, and what it collects, such as actions and resources, is outside that guarantee. Harden it with Datadog's own `beforeSend`.
- Size: Datadog cuts an error's context at 220 KiB and keeps only what fit. Flare's default size limit of 200,000 characters per report keeps a report below it; raise `privacy.limits.totalSize` past it and part of the context can be lost without a loss on the receipt.
- Flush: there is none, and `flare.flush()` reports `unsupported`. RUM sends its batches on its own schedule.
- Datadog is one instance per application. Register it under one destination name: two destinations over the same SDK report every exception twice.
- `native` is the SDK you passed in, fully typed, for everything Flare does not wrap, such as `setUser` and `addAction`. Calls made on it bypass Flare's routing, receipts and privacy.

## No ambient integration

Other adapters can mirror Flare's session into their provider's global state. This one cannot do so safely. RUM merges its global context and its user into every event when it assembles it, and nothing can take them back from one event. A mirror there would reach a report that waited in Flare's buffer while the account changed, and so describe someone else. The user and the global context stay yours.

## Tests

Mapping and lifecycle tests use an in-process fake, modelled on the source of `@datadog/browser-rum` 7.13, including its quirks: the global context merged over an error's own attributes, `__proto__` skipped by that merge, and causes followed through `cause`. A typecheck-only contract assigns the real SDK to its structural type. The real SDK never ran here: it did not start inside jsdom. No error was sent to Datadog.

## License

[MIT](LICENSE)
