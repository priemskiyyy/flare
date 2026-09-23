---
description: "The path a report takes through Flare, what the core owns, what an adapter owns, and where the guarantee ends."
---

# The mental model

One `Flare` per application holds named destinations. A report is built once by the core and handed, frozen, to each destination it was routed to.

```ts
import { Flare } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";
import { http } from "@priemskiyyy/flare-http";

const flare = new Flare({
  destinations: {
    backend: http({ request: sendReport }),
    console: console(),
  },
  defaults: { to: ["backend"] },
});
```

## The path of a report

1. **Refusals that need no work.** A report is dropped at once when Flare is disposed, when it was captured synchronously from inside an adapter's `submit`, when its scope belongs to a previous account, or when the storm limit is reached.
2. **Normalization.** Whatever was thrown becomes bounded plain data: a name, a message, a stack, a bounded cause chain. The thrown value itself goes no further.
3. **Validation and sanitizing.** Capture options are checked against your schema, redacted, scrubbed and bounded. An invalid piece is left out and recorded; the report continues.
4. **Composition.** Application defaults, the session, the operation scope and the capture options are merged, in that order.
5. **Size.** A report over the size limit sheds its oldest breadcrumbs, then its newest contexts.
6. **Routing.** The report's own `to`, or else `defaults.to`, selects destinations. A failure here drops the report rather than widening its audience.
7. **Per destination.** Dedupe, then the startup buffer or an immediate submission under a deadline.
8. **The receipt.** Each destination's outcome lands on the receipt. The first answer stands.

Session data, which is what `user`, `tag`, `context` and `breadcrumb` set, goes through validation and sanitizing when it is set, not when it is reported. That is what keeps unsanitized data out of the breadcrumb history, the startup buffer and the devtools.

## What the core owns, and what an adapter owns

The core owns policy: isolation, identity, privacy, routing, buffering, dedupe, deadlines and receipts. An adapter translates one sanitized report for one provider and does nothing else. The core never branches on which provider it is talking to, and an adapter never receives the thrown value.

When a provider cannot do something, the adapter does not imitate it. It records what was lost on the receipt, or skips the report with a reason. Crashlytics, for example, can attach nothing to a single report, so its adapter says so instead of setting and unsetting global state around each call. See [provider limitations](provider-limitations.md).

## Four rules that explain most behavior

- **Privacy outranks delivery.** A redactor or scrubber that throws costs the data it was given. A `defaults.to` that throws costs the report.
- **Delivery outranks metadata.** A tag that fails its schema costs only itself, never the error.
- **Flare never takes the application down.** Reporting and session calls never throw. Two programming mistakes do throw, so that you find them at once: a misconfigured constructor, and asking `destination()` for a name that was never configured.
- **Observation is passive.** Reading a status, a native handle or diagnostics starts nothing and reports nothing.
