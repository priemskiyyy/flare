---
description: "Report a failure with capture, report an abnormal condition with message, and understand what Flare does with whatever was thrown."
---

# Capture and message

## capture

`capture()` reports a failure. It is synchronous, it never throws, and it accepts anything, because JavaScript lets anything be thrown.

```ts
try {
  await save();
} catch (error) {
  flare.capture(error, {
    tags: { area: "editor" },
    contexts: { document: { id: "doc_7", revision: 12 } },
    operation: "save-document",
    level: "error",
  });
}
```

| Option       | What it does                                                                          |
| ------------ | ------------------------------------------------------------------------------------- |
| `tags`       | Tags for this report only, merged over the session tags by key.                       |
| `contexts`   | Contexts for this report only. A context replaces a session context of the same name. |
| `operation`  | A short name for what the application was doing.                                      |
| `level`      | `fatal`, `error`, `warning` or `info`. A capture defaults to `error`.                 |
| `user`       | Overrides the session user for this report only. `null` reports it as anonymous.      |
| `to`         | Sends this report to exactly these destinations. See [routing](routing.md).           |
| `dedupe.key` | Names the failure so that repeats are dropped. See below.                             |

## message

`message()` reports an abnormal condition that is not an exception. It takes the same options and defaults to the `info` level.

```ts
flare.message("Payment returned an unknown state", {
  level: "warning",
  tags: { area: "checkout" },
});
```

Flare is not a logger. A message is for something a person should look at, not for a record of normal activity. A provider that has no notion of a message says so: Crashlytics and, by default, Bugsnag skip messages with the reason `unsupported-report-kind`. See [provider limitations](provider-limitations.md).

## What happens to the thrown value

The value is turned into bounded plain data at once, and the original goes no further. No adapter, buffer or devtools panel ever holds your error object.

| What was thrown                | How it is reported                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| An `Error`                     | Its name, message and stack, its `cause` chain, and an `AggregateError`'s errors, all bounded. |
| An object shaped like an error | The same, with the origin `error-like`.                                                        |
| A `DOMException`               | The same, with the origin `dom-exception`.                                                     |
| A string, number or boolean    | A `NonError` whose message is the value.                                                       |
| `null` or `undefined`          | A `NonError` whose message is `null` or `undefined`.                                           |
| Any other object               | A `NonError` that lists the object's keys, never its values.                                   |
| A function                     | A `NonError` with the message `Function thrown`.                                               |

Reading a hostile value is contained. A getter that throws, a `Proxy` that throws, or a cause chain that loops costs the part that could not be read, and the report still goes out.

## Duplicates

The same error object is often caught twice, once where it happened and once in an error boundary. Flare drops the second report of the same object to the same destination when it arrives within one second.

When the failure has no stable object, name it:

```ts
flare.capture(new Error("Socket closed"), { dedupe: { key: "socket-closed" } });
```

A key is remembered per destination and per signed-in account, so a repeat after an account switch is reported again. Unlike the same-object check, a key has no time window: it stays remembered until 100 newer keys push it out, so use a key for a failure you want reported once, not once a second.

A dropped duplicate is visible on its receipt as `dropped` with the reason `deduped`. The `dedupe` option sets the window for the same-object check, where `0` turns that check off, and `maxKeys` sets how many keys are remembered:

```ts
import { Flare } from "@priemskiyyy/flare";
import { consoleReporter } from "@priemskiyyy/flare-console";

const flare = new Flare({
  destinations: { console: consoleReporter() },
  dedupe: { windowMs: 0 },
});
```

## Error storms

A render loop that throws can produce thousands of reports. Flare admits 120 reports a minute by default and drops the rest with the reason `rate-limited`, recording one diagnostic event when the limit is first reached. Change it with `limits: { reportsPerMinute }`.
