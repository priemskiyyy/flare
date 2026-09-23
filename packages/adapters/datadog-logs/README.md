# @priemskiyyy/flare-datadog-logs

Send [Flare](../../core) reports to Datadog Logs in the browser, messages included. You pass in the `datadogLogs` your application already initialized, so this package imports no SDK. To see exceptions in Datadog's error tracking as well, add [`@priemskiyyy/flare-datadog`](../datadog) for RUM beside it.

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-datadog-logs @datadog/browser-logs
```

## Create a Flare

The SDK and the adapter share a name, so import one of them under another:

```ts
import { datadogLogs as browserLogs } from "@datadog/browser-logs";
import { Flare } from "@priemskiyyy/flare";
import { datadogLogs } from "@priemskiyyy/flare-datadog-logs";

browserLogs.init({
  clientToken: "pub00000000000000000000000000000000",
  site: "datadoghq.eu",
});

const flare = new Flare({
  destinations: { logs: datadogLogs({ sdk: browserLogs }) },
});

flare.start();
browserLogs.setUser({ id: "user_42" });
flare.user({ id: "user_42" });
flare.message("Checkout retried", { tags: { area: "checkout" } });
```

## Options

| Option | Default  | Meaning                                            |
| ------ | -------- | -------------------------------------------------- |
| `sdk`  | required | `datadogLogs`, which your application initialized. |

There is no ambient option: the user and the global context stay yours.

## Who a report belongs to

Datadog attaches its current user to every log when it assembles it: the user your application set with `setUser`. A report without a user is sent under whoever that is. A report with a user is sent only when Datadog's user has that user's `id`, and is otherwise skipped as `identity-mismatch`, so a report captured before an account switch never lands on the wrong user. Give Flare and Datadog the same id, and change them together.

## How a report is mapped

Each report is one log sent through the default logger. Everything it carries beyond its message, status and error travels under `flare`, one attribute of the log. Datadog puts your global context at the top level of every log, beside `flare`: keep that one name for Flare.

| Flare             | Datadog log                                                                        |
| ----------------- | ---------------------------------------------------------------------------------- |
| exception         | the log's `error`, from an `Error` rebuilt from the sanitized report               |
| cause chain       | `error.causes`, which Datadog follows through `cause`                              |
| aggregated errors | `flare.aggregated`, with each error's name and message                             |
| message           | the log's message                                                                  |
| exception message | the log's message, or the error's name when it has none                            |
| `level`           | the status: `info`, `warn`, `error`, and `critical` for `fatal`, and `flare.level` |
| `identity.user`   | the user Datadog attaches, as described above                                      |
| `tags`            | `flare.tags`                                                                       |
| `contexts`        | `flare.contexts`                                                                   |
| `breadcrumbs`     | `flare.breadcrumbs`, each with its name, its data and its time in ISO form         |
| `operation`       | `flare.operation`                                                                  |
| report id         | `flare.report_id`, so the same report can be found in every destination            |
| time              | when the report is submitted                                                       |

Losses, each `unsupported`: a tag or context named `__proto__`, which Datadog's merge skips.

## Behavior

- Versions: `@datadog/browser-logs` 7, an optional peer dependency, typed structurally through `DatadogLogsLike`.
- Initialization is yours. An SDK that `init` has not run on fails the destination's start with a `FlareError` whose code is `NOT_INITIALIZED`: until `init`, the SDK keeps logs in a buffer of its own and sends them only if `init` ever runs. Call `flare.start()` again after `init` and it succeeds, and the reports captured meanwhile are delivered while they are still in Flare's buffer.
- Evidence is `sdk-call-returned`, and there is no event id. `log` answers nothing, and the logger's level and handler, tracking consent, sampling, `beforeSend` and rate limits can drop a log after it returns without saying so.
- Automatic collection is Datadog's own. Console errors and runtime errors that `forwardErrorsToLogs` collects never pass through Flare. Give each source one owner, or one error is logged twice.
- Privacy: what Flare submits was redacted, scrubbed and bounded by the core. What Datadog adds, such as the view, the session, your global context and your user, is outside that guarantee. Harden it with `beforeSend`.
- Flush: there is none, and `flare.flush()` reports `unsupported`. The SDK sends its batches on its own schedule, and when the page is hidden.
- `native` is the SDK you passed in, fully typed, for everything Flare does not wrap, such as `createLogger`. Logs sent on it bypass Flare's routing, receipts and privacy.

## Tests

Mapping and lifecycle tests use an in-process fake modelled on the source of `@datadog/browser-logs` 7.13, including its quirks: a log's own context merged over the global context and the user, `__proto__` skipped by that merge, causes followed through `cause`, and "Empty message" for an error without one. A typecheck-only contract assigns the real SDK to its structural type. The real SDK never ran here, and no log was sent to Datadog.

## License

[MIT](LICENSE)
