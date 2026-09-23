---
description: "Send a Flare report to one destination, to several, or decide per report, and see what happens when routing itself fails."
---

# Routing

Destinations have names. The names are typed, so a destination that does not exist is a compile error.

```ts
import { Flare } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";
import { http } from "@priemskiyyy/flare-http";
import { sentry } from "@priemskiyyy/flare-sentry";
import * as Sentry from "@sentry/browser";

const flare = new Flare({
  destinations: {
    sentry: sentry({ sdk: Sentry }),
    backend: http({ request: sendReport }),
    console: console(),
  },
  defaults: { to: ["sentry", "backend"] },
});
```

## Choosing destinations

**`defaults.to`** says where a report goes unless the report says otherwise. Without it, a report goes to every destination. A list that names a destination you never configured throws a `FlareError` with the code `INVALID_CONFIGURATION` from the constructor.

**`to`** on one report replaces `defaults.to` for that report. It never merges with it:

```ts
flare.capture(error, { to: ["backend"] });
```

**`defaults.to`** can also be a function that decides per report. It receives the finished, sanitized report and returns names:

```ts
import { Flare } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";
import { http } from "@priemskiyyy/flare-http";

const flare = new Flare({
  destinations: {
    backend: http({ request: sendReport }),
    console: console(),
  },
  defaults: {
    to: ({ report }) => {
      if (report.tags.area === "billing") {
        return ["backend", "console"];
      }

      return ["console"];
    },
  },
});
```

A report's own `to` wins over the function too, and the function is not called for it. Returning an empty list drops the report with the reason `no-destinations`, which is how you filter a report out entirely.

A report's `to` is not checked against `defaults.to`: it replaces it. Keep what must never reach a destination out of the report with [redaction](privacy.md), which runs before any destination sees the report, however it was chosen.

## Routing fails closed

A broken rule must never widen the audience. When a `defaults.to` function throws, returns something that is not a list, or names a destination that does not exist, or a report's `to` names one, the report is dropped with the reason `route-failed`. It is not sent anywhere else.

## Fan-out is independent

Each destination gets the same frozen report and its own outcome. A destination that is slow, down or throwing does not delay or affect the others. A destination that does not answer within `timeout`, five seconds by default, settles as `indeterminate` with the reason `timeout`, because the report may or may not have arrived.

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
import { console } from "@priemskiyyy/flare-console";
import { http } from "@priemskiyyy/flare-http";

const getDefaultDestinations = (): Array<"backend" | "console"> => {
  if (import.meta.env.PROD) {
    return ["backend"];
  }

  return ["console"];
};

const flare = new Flare({
  destinations: {
    backend: http({ request: sendReport }),
    console: console(),
  },
  defaults: { to: getDefaultDestinations() },
});
```
