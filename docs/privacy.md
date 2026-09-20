---
description: "How Flare redacts keys, scrubs text and bounds size before a report is kept, observed or sent, and what happens when a scrubber fails."
---

# Privacy and redaction

Sanitizing happens at the door. Session data is sanitized when it is set, and report data when it is captured. Nothing unsanitized is ever kept in the breadcrumb history, held in the startup buffer, shown in the devtools, written to diagnostics or handed to an adapter.

## Redacting by key

A value whose key matches a rule is replaced with `[Redacted]`. With no configuration, keys containing `token`, `authorization`, `password`, `secret`, `cookie` or `api key` are redacted, at any depth.

```ts
flare.context("request", {
  url: "/api/orders",
  headers: { Authorization: "Bearer abc", Accept: "application/json" },
});
// headers: { Authorization: "[Redacted]", Accept: "application/json" }
```

Your own rules replace the defaults, so spread `DEFAULT_REDACT` to keep them:

```ts
import { DEFAULT_REDACT, Flare } from "@priemskiyyy/flare";
import { consoleReporter } from "@priemskiyyy/flare-console";

const flare = new Flare({
  destinations: { console: consoleReporter() },
  privacy: {
    redact: [...DEFAULT_REDACT, "iban", /^card/i, "contexts.customer.address"],
  },
});
```

A rule is one of three things:

- a string, which matches a key of that name at any depth, ignoring case
- a string holding a full path, such as `contexts.customer.address`, which matches that one place
- a regular expression, which is tested against each key

## Scrubbing text

Keys do not help when the secret is inside a string, such as an email address in an error message. `scrub` sees every string, with its path, and returns what should be sent:

```ts
import { Flare } from "@priemskiyyy/flare";
import { consoleReporter } from "@priemskiyyy/flare-console";

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;

const flare = new Flare({
  destinations: { console: consoleReporter() },
  privacy: {
    scrub: (text) => text.replace(EMAIL, "[email]"),
  },
});
```

It runs on error messages, stacks, message reports, tag values, context values and breadcrumb data. It does not rewrite the user's `id`, `email` or `name`: identity fields are governed by redaction rules only, so a scrubber cannot merge two accounts into one.

## A scrubber that fails

Privacy outranks delivery. If `scrub` throws, or returns something that is not a string, Flare cannot know what it would have removed, so it does not send the data:

- during `capture()` or `message()`, the whole report is dropped with the reason `sanitizer-failed`
- during `tag()`, `context()`, `breadcrumb()` or `user()`, that one piece of session data is refused

Neither case throws into your application, and both are recorded in diagnostics without the payload.

## Bounds

Every report is bounded, so a huge or hostile object cannot exhaust memory or exceed a provider's limits. Change any of these with `privacy.limits`.

| Limit              | Default | What it bounds                            |
| ------------------ | ------- | ----------------------------------------- |
| `depth`            | 6       | nesting depth of a context or breadcrumb  |
| `breadth`          | 50      | keys of one object, or items of one array |
| `stringLength`     | 2000    | any string value                          |
| `messageLength`    | 1000    | an error message or a message report      |
| `stackLength`      | 8000    | a stack trace                             |
| `causeDepth`       | 5       | the `cause` chain                         |
| `aggregatedErrors` | 5       | the errors of an `AggregateError`         |
| `breadcrumbs`      | 50      | retained breadcrumbs                      |
| `totalSize`        | 200000  | the estimated size of a whole report      |

A report over `totalSize` sheds its oldest breadcrumbs first, then its most recently added contexts. What the report is about, the error itself, is never shed. Everything that was cut is recorded on the report as a loss with the reason `truncated`.

Values that are not plain data are replaced with a marker instead of being read: `[Circular]`, `[Function]`, `[Accessor]` for a getter, which Flare never runs, `[Unreadable]`, `[Depth limit]` and `[Size limit]`.

## What Flare cannot protect

Calls you make on a provider SDK directly, including through [native access](native-access.md), bypass all of this. So does whatever the provider's own automatic instrumentation collects. Configure that in the provider SDK.
