---
description: "Every option a Flare takes, with its default and unit, and what the constructor refuses."
---

# Configuration

Everything is set when the Flare is constructed, and durations are in milliseconds everywhere.

```ts
import { Flare, isSensitiveKey } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";
import { http } from "@priemskiyyy/flare-http";

const flare = new Flare({
  destinations: {
    backend: http({ request: sendReport }),
    console: console(),
  },
  defaults: { to: ["backend"] },
  privacy: { redact: (key) => isSensitiveKey(key) || key === "iban" },
  timeout: 3_000,
  rateLimits: { perMinute: 60 },
});
```

| Option                               | Default                         | Meaning                                                                                                                                           |
| ------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `destinations`                       | required                        | Named adapters. The names are typed everywhere.                                                                                                   |
| `schema`                             | none                            | Standard Schema validators for tags, contexts and breadcrumbs. See [metadata](metadata.md).                                                       |
| `defaults.to`                        | every destination               | Where a report goes: a list of names, or a function of `{ report }` that returns one. A report's own `to` replaces it. See [routing](routing.md). |
| `defaults.tags`, `defaults.contexts` | none                            | Tags and contexts every report carries, across account changes. A report's own are merged over them.                                              |
| `privacy.redact`                     | `isSensitiveKey`                | Decides which values are replaced with `[Redacted]`. See [privacy](privacy.md).                                                                   |
| `privacy.scrub`                      | none                            | Rewrites free text.                                                                                                                               |
| `privacy.limits`                     | see [bounds](privacy.md#bounds) | Bounds on every report's size.                                                                                                                    |
| `buffer.capacity`                    | 30                              | Reports each destination holds until it is ready.                                                                                                 |
| `buffer.maxAge`                      | 60000                           | How long a report may wait there.                                                                                                                 |
| `timeout`                            | 5000                            | How long a destination may take before its outcome is `indeterminate`.                                                                            |
| `dedupe.window`                      | 1000                            | How long the same thrown object counts as a repeat. `0` turns this check off.                                                                     |
| `rateLimits.perMinute`               | 120                             | Reports admitted per minute. The rest are dropped as `rate-limited`.                                                                              |
| `now`                                | `Date.now`                      | The clock, for tests. One that throws or answers no number gives way to `Date.now`.                                                               |

`flare.flush({ timeout })` waits 2000 ms unless told otherwise. See [flush](flush.md).

## What the constructor refuses

A Flare that cannot work throws a `FlareError` with the code `INVALID_CONFIGURATION` from its constructor, so you find the mistake at startup. The message names the option.

- A count that is not a whole number of 0 or more: `buffer.capacity`, `rateLimits.perMinute` and every entry of `privacy.limits`.
- A duration outside 0 to 2147483647 ms, the longest delay a timer can hold: `buffer.maxAge`, `timeout` and `dedupe.window`.
- A `defaults.to` list that names a destination you never configured.
- A `redact` or `scrub` that is not a function.
- `defaults` that fail the schema, or that `redact` or `scrub` fails on.

An option set to `undefined` keeps its default. `flush` never throws: it clamps its timeout into the same range.
