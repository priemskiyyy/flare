# @priemskiyyy/flare-console

Print [Flare](../../core) error reports while you develop. The adapter receives what every destination receives, so its output is already redacted.

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-console
```

## Create a Flare

```ts
import { Flare } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";

const flare = new Flare({
  destinations: { console: console() },
});

flare.start();
flare.capture(new Error("Upload failed"), { tags: { area: "upload" } });
// [flare] error Error: Upload failed  { id, tags, contexts, breadcrumbs, ... }
```

## Options

| Option   | Default            | Meaning                                                                                            |
| -------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| `writer` | the global console | Receives `{ level, line, report }` for each report. Use it to write to a logger, a file or a test. |

## Behavior

- Platforms: anywhere JavaScript runs. There is no SDK and nothing to initialize.
- Without a `writer`, `fatal` and `error` go to `console.error`, `warning` to `console.warn` and `info` to `console.info`. The console is read when a report is written, so one replaced later is honoured.
- Importing `console` from this package shadows the global `console` in that module. TypeScript flags a `console.log` there; import it as `{ console as consoleAdapter }` if the module also logs.
- Mapping: nothing is lost. The writer receives a one line summary and the whole frozen report. `losses` is always empty.
- Privacy: the report was redacted, scrubbed and bounded by the core before it arrived. The adapter adds nothing to it.
- Feedback loops: if your console is instrumented to turn `console.error` into a report, the capture made from inside the write is dropped as `reentrant`, so the loop ends after one line. Instrumentation that forwards asynchronously is outside that guard; give it a `writer` that bypasses the instrumented console.
- Evidence is `sdk-call-returned`: the writer returned. If it returns a promise, the receipt waits for it. A writer that throws or rejects produces a `failed` outcome and never reaches your application.
- There is no queue, no offline storage, no automatic capture and no SDK `flush`. `flare.flush()` drains pending writes and reports the provider boundary as `unsupported`.
- `native` is the writer in use.
- Tests run against an injected writer and a spied console. No backend is involved.

## License

[MIT](LICENSE)
