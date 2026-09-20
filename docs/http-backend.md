---
description: "The request Flare's HTTP adapter sends, what your endpoint must answer, how idempotency and per-user authorization work, and what the adapter does not do."
---

# HTTP backend contract

The HTTP adapter posts each report to an endpoint you own. It is the only built-in adapter whose receipt rests on a server's answer.

```ts
import { Flare } from "@priemskiyyy/flare";
import { http } from "@priemskiyyy/flare-http";

const flare = new Flare({
  destinations: {
    backend: http({
      endpoint: "https://api.example.com/error-reports",
      headers: { "x-app-version": "2.4.0" },
    }),
  },
});
```

## The request

```http
POST /error-reports
content-type: application/json
idempotency-key: 5f0c1c9e-6b1e-4a53-9d0e-2f6a1d0c7b11
```

The body is the sanitized report as JSON:

```json
{
  "id": "5f0c1c9e-6b1e-4a53-9d0e-2f6a1d0c7b11",
  "kind": "exception",
  "timestamp": 1790000000000,
  "level": "error",
  "identity": { "generation": 1, "user": { "id": "user_42" } },
  "tags": { "area": "checkout" },
  "contexts": { "cart": { "id": "c_1", "items": 3 } },
  "breadcrumbs": [
    {
      "name": "checkoutOpened",
      "data": { "cartId": "c_1" },
      "timestamp": 1789999998000
    }
  ],
  "operation": "submit-order",
  "losses": [],
  "exception": {
    "name": "TypeError",
    "message": "Cannot read properties of undefined",
    "stack": "TypeError: Cannot read properties of undefined\n    at submit (checkout.js:41:9)",
    "origin": "error",
    "causes": [],
    "aggregated": []
  }
}
```

A message report has `"kind": "message"` and a `message` string in place of `exception`. The types are exported, so a TypeScript backend can share them:

```ts
import type { SanitizedReport } from "@priemskiyyy/flare";

const handleReport = (report: SanitizedReport) => {
  if (report.kind === "exception") {
    console.log(report.exception.name, report.exception.message);
  }
};
```

## What your endpoint must do

- **Answer with a `2xx` status only once the report is safe.** That answer becomes `backend-acknowledged` evidence. Anything else is a `failed` outcome carrying the status code.
- **Treat `idempotency-key` as the report's identity.** Store it, and answer a repeat with success without storing the report twice. Flare does not retry, but proxies, service workers and your own retry layer might.
- **Optionally return an id.** A JSON body shaped like `{ "id": "evt_123" }` becomes the receipt's `event.id`. No body is fine too.
- **Validate the body.** It comes from a client, so treat it as untrusted input like any other request.

## Authorization per user

Static headers go in `headers`, which may also be a function, sync or async. Credentials that belong to the signed-in user go in `authorize`, which receives the user the report belongs to:

```ts
import { http } from "@priemskiyyy/flare-http";

const destination = http({
  endpoint: "/api/error-reports",
  authorize: async ({ user }) => {
    if (user === null) {
      return {};
    }
    return { authorization: `Bearer ${await session.getToken()}` };
  },
});
```

Fetching a token takes time, and the account can change while it does. The adapter checks the account before and after `authorize` runs. If it changed, the report is skipped with the reason `auth-subject-mismatch`, so one account's report is never sent with another account's credentials.

## What it does not do

There is no retry, no queue and no offline storage. A report is sent once, and the receipt says what happened. A request that outlives `deadlineMs` is aborted through its `AbortSignal` and settles as `indeterminate`, because the server may already have received it. If you need retries, build them where you can see the receipt, and rely on the idempotency key to make them safe.

## A custom fetch

Pass `fetch` to use something other than the global one, for a runtime without a global `fetch` or for a client that adds tracing:

```ts
import { http } from "@priemskiyyy/flare-http";

const destination = http({
  endpoint: "/api/error-reports",
  fetch: (input, init) => fetch(input, { ...init, keepalive: true }),
});
```

`keepalive` lets a request outlive the page, which helps reports sent while the page is being hidden.
