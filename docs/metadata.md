---
description: "Tags, contexts and breadcrumbs in Flare: what each is for, how they merge, and how to type them with a Standard Schema validator."
---

# Tags, contexts, breadcrumbs

| Kind       | Shape                            | Use it for                                  |
| ---------- | -------------------------------- | ------------------------------------------- |
| Tag        | one string, number or boolean    | what you will search and filter by          |
| Context    | a named object                   | structured detail you will read, not search |
| Breadcrumb | a name, optional data and a time | what happened before the failure            |

## Session and report

Set something on the Flare and every later report carries it. Pass it to `capture()` and only that report carries it.

```ts
flare.tag("plan", "pro");
flare.context("workspace", { id: "w_1", members: 12 });
flare.breadcrumb("checkoutOpened", { cartId });

flare.capture(error, { tags: { area: "checkout" } });

flare.tag("plan", null);
flare.context("workspace", null);
```

Passing `null` removes a session tag or context. A report is composed from four layers, later ones winning: the `defaults` option, the session, the [scope](scopes.md), then the capture options. Tags merge by key. A context is replaced as a whole and never merged with an earlier context of the same name, so a report cannot show half of one object and half of another.

Application-wide values that never change belong in `defaults`:

```ts
import { Flare } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";

const flare = new Flare({
  destinations: { console: console() },
  defaults: {
    tags: { release: "2.4.0" },
    contexts: { build: { commit: "a91b44e" } },
  },
});
```

Defaults are checked when the Flare is constructed. One that fails the schema throws a `FlareError` with the code `INVALID_CONFIGURATION`, such as `Flare's defaults are invalid at tags.release.`

## Breadcrumbs

Flare keeps the most recent 50 breadcrumbs, or `privacy.limits.breadcrumbs`, and attaches them to each report. An event that happened earlier than the moment you record it can carry its own time:

```ts
flare.breadcrumb(
  "requestFailed",
  { status: 503 },
  { timestamp: Date.now() - 1200 },
);
```

Breadcrumbs belong to the signed-in account. Changing the user clears them, and a breadcrumb whose explicit timestamp is older than the current account is refused. See [users and account switching](identity.md).

## Typing them

Without a schema, every tag, context and breadcrumb name is accepted. Pass a schema and the names and shapes are checked by TypeScript at the call and by the validator at runtime. Any validator that implements Standard Schema works. This example uses Zod:

```ts
import { Flare } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";
import { z } from "zod";

const flare = new Flare({
  destinations: { console: console() },
  schema: {
    tags: {
      area: z.enum(["checkout", "upload"]),
      plan: z.string(),
    },
    contexts: {
      cart: z.object({ id: z.string(), items: z.number() }),
    },
    breadcrumbs: {
      checkoutOpened: z.object({ cartId: z.string() }),
    },
  },
});

flare.tag("area", "checkout");
flare.context("cart", { id: "c_1", items: 3 });
flare.breadcrumb("checkoutOpened", { cartId: "c_1" });
```

Call sites accept the schema's input type. Flare validates and transforms it once, then sanitizes the output before storing or sending it. A breadcrumb's data is required when its schema requires it; schemas with a default may omit data.

```ts
import { Flare } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";
import { z } from "zod";

const flare = new Flare({
  destinations: { console: console() },
  schema: { tags: { attempt: z.string().transform(Number) } },
});

flare.tag("attempt", "2"); // The report carries the number 2.
```

A validator must answer synchronously, because `capture()` does. One that returns a promise is treated as a failure.

## When something is invalid

Delivery outranks metadata. A tag that fails its schema is left out, and the error is still reported. What was left out is recorded on the report as a loss, such as `{ path: "tags.area", reason: "invalid" }`, so the destination's receipt shows it. The same applies to a value that had to be cut to fit a limit, with the reason `truncated`.
