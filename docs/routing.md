---
description: "Send a Flare report to one destination, to several, or decide per report, and see what happens when routing itself fails."
---

# Routing

Destinations have names. The names are typed, so a destination that does not exist is a compile error.

```ts
import { Flare } from "@priemskiyyy/flare";
import { consoleReporter } from "@priemskiyyy/flare-console";
import { http } from "@priemskiyyy/flare-http";
import { sentry } from "@priemskiyyy/flare-sentry";
import * as Sentry from "@sentry/browser";

const flare = new Flare({
  destinations: {
    sentry: sentry({ sdk: Sentry }),
    backend: http({ endpoint: "/api/error-reports" }),
    console: consoleReporter(),
  },
  default: ["sentry", "backend"],
});
```

## The three ways to choose

**`default`** lists where a report goes when nothing else says. Without it, a report goes to every destination.

**`to`** on one report replaces the default for that report:

```ts
flare.capture(error, { to: ["backend"] });
```

**`route`** decides per report. It receives the finished, sanitized report and returns names. `route` and `default` are mutually exclusive.

```ts
import { Flare } from "@priemskiyyy/flare";
import { consoleReporter } from "@priemskiyyy/flare-console";
import { http } from "@priemskiyyy/flare-http";

const flare = new Flare({
  destinations: {
    backend: http({ endpoint: "/api/error-reports" }),
    console: consoleReporter(),
  },
  route: ({ report }) => {
    if (report.tags.area === "billing") {
      return ["backend", "console"];
    }
    return ["console"];
  },
});
```

An explicit `to` wins over `route`. Returning an empty list drops the report with the reason `no-destinations`, which is how you filter a report out entirely.

## Routing fails closed

A route decides who may see a report, so a broken route must never widen the audience. When `route` throws, returns something that is not a list, or names a destination that does not exist, the report is dropped with the reason `route-failed`. It is not sent to the default, and it is not sent to everyone.

## Fan-out is independent

Each destination gets the same frozen report and its own outcome. A destination that is slow, down or throwing does not delay or affect the others. A destination that does not answer within `deadlineMs`, five seconds by default, settles as `indeterminate` with the reason `deadline`, because the report may or may not have arrived.

```ts
const receipt = flare.capture(error);
const status = await receipt.settled;

if (status.state === "settled") {
  console.log(status.outcomes.sentry?.status, status.outcomes.backend?.status);
}
```

See [receipts and evidence](receipts.md).

## Per environment

Routing is ordinary configuration, so choosing destinations per environment is ordinary code:

```ts
import { Flare } from "@priemskiyyy/flare";
import { consoleReporter } from "@priemskiyyy/flare-console";
import { http } from "@priemskiyyy/flare-http";

const isProduction = import.meta.env.PROD;

const flare = new Flare({
  destinations: {
    backend: http({ endpoint: "/api/error-reports" }),
    console: consoleReporter(),
  },
  default: isProduction ? ["backend"] : ["console"],
});
```
