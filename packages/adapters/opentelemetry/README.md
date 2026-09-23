# @priemskiyyy/flare-opentelemetry

Send [Flare](../../core) reports to OpenTelemetry as log records, and through your provider's exporter to any OTLP backend, such as Honeycomb, Grafana, Elastic or New Relic. You pass in the logger your provider made, so this package imports no OpenTelemetry package.

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-opentelemetry @opentelemetry/api-logs
```

Set up a logger provider and an exporter as OpenTelemetry describes, for example `@opentelemetry/sdk-logs` with an OTLP exporter.

## Create a Flare

Pass the logger of the provider your application set up:

```ts
import { logs } from "@opentelemetry/api-logs";
import { Flare } from "@priemskiyyy/flare";
import { opentelemetry } from "@priemskiyyy/flare-opentelemetry";

const flare = new Flare({
  destinations: { otel: opentelemetry({ logger: logs.getLogger("app") }) },
});

flare.start();
flare.user({ id: "user_42" });
flare.capture(new Error("Upload failed"), { tags: { area: "upload" } });
```

Give it the provider's `forceFlush` too, and `flare.flush()` waits for the export:

```ts
import { LoggerProvider } from "@opentelemetry/sdk-logs";
import { opentelemetry } from "@priemskiyyy/flare-opentelemetry";

// Your processors and exporter, such as a batch processor over OTLP.
const provider = new LoggerProvider({ processors: [] });

export const otel = opentelemetry({
  logger: provider.getLogger("app"),
  forceFlush: () => provider.forceFlush(),
});
```

## Options

| Option       | Default  | Meaning                                                                                        |
| ------------ | -------- | ---------------------------------------------------------------------------------------------- |
| `logger`     | required | The logger your provider made, such as `provider.getLogger("app")` or `logs.getLogger("app")`. |
| `forceFlush` | none     | Exports what the provider's processors hold, such as `() => provider.forceFlush()`.            |

## How a report is mapped

Each report is one log record. A record carries everything itself, so nothing is shared between reports and nothing global is written: a report keeps the user it was captured under, even when it waited in Flare's buffer through an account switch.

| Flare             | Log record                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------- |
| exception         | `exception.type`, `exception.message` and `exception.stacktrace`, the semantic names          |
| cause chain       | `flare.causes`, with each cause's name, message and stack                                     |
| aggregated errors | `flare.aggregated`, with each error's name and message                                        |
| message           | the body, with no exception attributes                                                        |
| body              | the message, or the error's message, or its name when it has none                             |
| `level`           | the severity: `info` is INFO (9), `warning` WARN (13), `error` ERROR (17), `fatal` FATAL (21) |
| `identity.user`   | `user.id`, `user.email`, and the name as `user.full_name`                                     |
| `tags`            | `flare.tags`, one map                                                                         |
| `contexts`        | `flare.contexts`, one map of maps                                                             |
| `breadcrumbs`     | `flare.breadcrumbs`, each with its name, its data and its time in ISO form                    |
| `operation`       | `flare.operation`                                                                             |
| report id         | `flare.report_id`, so the same report can be found in every destination                       |
| time              | the record's timestamp: when the report was captured                                          |

Tags, contexts and breadcrumbs are nested values, which the log data model allows. A backend that flattens them shows `flare.tags.area` and so on. There are no losses: everything a report carries fits a log record.

## Behavior

- Versions: `@opentelemetry/api-logs` 0.200 or later within 0.x, an optional peer dependency, typed structurally through `OpenTelemetryLoggerLike`. The API is still 0.x, and the adapter uses only `emit`.
- The provider is yours. Flare never creates, configures or shuts it down.
- Evidence is `sdk-call-returned`, and there is no event id. `emit` answers nothing: the processors export the record on their own schedule, and a logger that is disabled, below its minimum severity or shut down drops it without saying so.
- Limits: the SDK keeps at most `attributeCountLimit` attributes per record, 128 by default, and cuts values past `attributeValueLengthLimit` if you set one. A report uses about a dozen attributes, and a cut is not a loss on the receipt.
- Flush: with `forceFlush`, `flare.flush()` waits for the export and reports a failed export as `failed`. Without it, `flare.flush()` reports `unsupported`. Flare bounds the wait either way.
- Privacy: what Flare submits was redacted, scrubbed and bounded by the core. What your provider adds, such as the resource and its attributes, is outside that guarantee.
- `native` is the logger you passed in, fully typed. Records emitted on it bypass Flare's routing, receipts and privacy.

## Tests

Mapping and lifecycle tests use an in-process fake logger. An integration test runs the installed `@opentelemetry/sdk-logs` 0.222 with an in-memory exporter, and checks that every attribute survives the SDK's validation, with the record's severity, body and capture time. A typecheck-only contract assigns the real API and SDK loggers to the structural type. No record was sent to a collector or a backend.

## License

[MIT](LICENSE)
