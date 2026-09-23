---
description: "How Flare redacts keys, scrubs text and bounds size before a report is kept, observed or sent, and what happens when redaction or a scrubber fails."
---

# Privacy and redaction

Sanitizing happens at the door. Session data is sanitized when it is set, and report data when it is captured. Nothing unsanitized is ever kept in the breadcrumb history, held in the startup buffer, shown in the devtools, written to diagnostics or handed to an adapter.

## Redacting by key

`redact` decides which values are replaced with `[Redacted]`. It is asked about every key in tags, contexts, breadcrumb data and the user, with its dotted path, such as `iban` at `contexts.payment.iban`. It is also asked about each context and breadcrumb by its name: a context it names is left out whole, and a breadcrumb it names keeps its name and loses its data.

Without configuration, `isSensitiveKey` decides. It matches a key that names a credential anywhere in it, whatever the case or separator: `token`, `authorization`, `password` or `passwd`, `secret`, `cookie`, `credential`, `bearer`, `jwt`, `session_id`, and `api_key`, `access_key` or `private_key`. So `cardToken` and `x-api-key` are redacted too.

```ts
flare.context("request", {
  url: "/api/orders",
  headers: { Authorization: "Bearer abc", Accept: "application/json" },
});
// headers: { Authorization: "[Redacted]", Accept: "application/json" }
```

Your own `redact` replaces the default, so call `isSensitiveKey` from it to keep the defaults:

```ts
import { Flare, isSensitiveKey } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";

const flare = new Flare({
  destinations: { console: console() },
  privacy: {
    redact: (key, path) =>
      isSensitiveKey(key) ||
      key === "iban" ||
      path === "contexts.customer.address",
  },
});
```

It runs for every key, so it must be synchronous and cheap. It never sees text: messages, exceptions and the operation are only scrubbed. If `redact` names the user's `id`, the report's user id reads `[Redacted]`, and Flare still tells accounts apart by the real id.

## Scrubbing text

Keys do not help when the secret is inside a string, such as an email address in an error message. `scrub` rewrites free text, with its path, and returns what should be sent:

```ts
import { Flare } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;

const flare = new Flare({
  destinations: { console: console() },
  privacy: {
    scrub: (text) => text.replace(EMAIL, "[email]"),
  },
});
```

It runs on error messages and stacks, message reports, the operation, breadcrumb names and every string value in tags, contexts and breadcrumb data. It never sees keys, error names or the user's `id`, `email` and `name`: identity fields are governed by `redact` only, so a scrubber cannot merge two accounts into one. Keys, tag names and context names are kept as given, so never put data in a name.

## When redaction or scrubbing fails

Privacy outranks delivery. If `redact` or `scrub` throws, or `scrub` returns something that is not a string, Flare cannot know what it would have removed, so it does not send the data:

- during `capture()` or `message()`, the whole report is dropped with the reason `sanitizer-failed`
- during `tag()`, `context()`, `breadcrumb()` or `user()`, that one piece of session data is refused
- during `scope()`, the scope contributes nothing, and each report it captures records a `scope` loss with the reason `invalid`
- in `defaults`, the constructor throws a `FlareError` with the code `INVALID_CONFIGURATION` and the failure as its `cause`

Only the constructor throws, because the defaults are configuration. Every other case is recorded in diagnostics without the payload. A `redact` or `scrub` that is not a function also throws from the constructor.

## Bounds

Every report is bounded, so a huge or hostile object cannot exhaust memory or exceed a provider's limits. Change any of these with `privacy.limits`. Each must be a whole number of 0 or more, or the constructor throws.

| Limit              | Default | What it bounds                                       |
| ------------------ | ------- | ---------------------------------------------------- |
| `depth`            | 6       | nesting depth of a value                             |
| `breadth`          | 50      | keys of one object, or items of one array            |
| `stringLength`     | 2000    | any string value, the operation and breadcrumb names |
| `messageLength`    | 1000    | an error message or a message report                 |
| `stackLength`      | 8000    | a stack trace                                        |
| `causeDepth`       | 5       | the `cause` chain                                    |
| `aggregatedErrors` | 5       | the errors of an `AggregateError`                    |
| `breadcrumbs`      | 50      | retained breadcrumbs                                 |
| `totalSize`        | 200000  | the serialized size of a whole report, in characters |

A report over `totalSize` sheds its oldest breadcrumbs first, then its most recently added contexts. What the report is about, the error itself, is never shed. Everything that was cut is recorded on the report as a loss with the reason `truncated`.

## Values that are not plain data

Flare copies data without running any of it:

- A getter or setter becomes `[Accessor]`, and Flare never calls it. A cycle becomes `[Circular]`, a function `[Function]`, and an object whose properties cannot be read `[Unreadable]`.
- Past `depth` a value becomes `[Depth limit]`, and past `totalSize` `[Size limit]`.
- A `Date` becomes its ISO string, or `[Invalid Date]`. A `URL` becomes its text, scrubbed and bounded like any string, or `[Invalid URL]`.
- A `Map`, `Set`, `WeakMap`, `WeakSet`, `Promise`, `RegExp` or `Error` becomes `[Map]`, `[Set]` and so on, and binary data becomes `[Binary]`, each with an `unsupported` loss: their content lives outside their own properties.
- `NaN` and the infinities become their names, and a bigint or a symbol becomes its string.
- An `undefined` property is left out, and in an array it becomes `null`.

## What Flare cannot protect

Calls you make on a provider SDK directly, including through [native access](native-access.md), bypass all of this. So does whatever the provider's own automatic instrumentation collects. Configure that in the provider SDK.
