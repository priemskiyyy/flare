---
description: "What the HTTP adapter's request must do, a reference implementation over fetch, what your endpoint must answer, and how reports stay with their own account."
---

# HTTP backend contract

The HTTP adapter sends each report through a `request` function you write over your own client. It is the only built-in adapter whose receipt rests on your server's answer, so the contract below is what that answer means.

## A reference request

```ts
import { Flare } from "@priemskiyyy/flare";
import { http } from "@priemskiyyy/flare-http";

// An acknowledgement needs no body, and a body need not be JSON.
const readAcknowledgement = async (response: Response) => {
  try {
    const body: unknown = await response.json();

    if (typeof body !== "object" || body === null || !("id" in body)) {
      return undefined;
    }

    if (typeof body.id !== "string") {
      return undefined;
    }

    return { id: body.id };
  } catch {
    return undefined;
  }
};

const flare = new Flare({
  destinations: {
    backend: http({
      request: async ({ report, signal }) => {
        const response = await fetch("/api/error-reports", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": report.id,
          },
          body: JSON.stringify(report),
          signal,
          // Lets a report sent while the page is being hidden outlive the page.
          keepalive: true,
        });

        if (!response.ok) {
          throw new Error(
            `The error report endpoint answered ${response.status}.`,
          );
        }

        return readAcknowledgement(response);
      },
    }),
  },
});
```

Your own API client works the same way: call it, pass `signal`, resolve once the backend accepted the report, and throw when it did not.

## What `request` must do

- **Resolve only once your backend accepted the report.** A resolved request is `backend-acknowledged` evidence. Resolve with `{ id }` to put the backend's reference on the receipt as `event.id`, or with nothing.
- **Throw or reject when it did not.** The outcome is `failed`, carrying your error, and the report is not sent again.
- **Send `report.id` as the idempotency key.** Proxies, service workers and your own retries can deliver a report twice.
- **Pass `signal` on.** It aborts when the `timeout` passes and when the Flare is disposed. A report past its deadline settles as `indeterminate`, because the server may already have received it.

## The body

`JSON.stringify(report)` is the sanitized report:

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

- **Answer with a `2xx` status only once the report is safe.** Your `request` turns that answer into `backend-acknowledged` evidence.
- **Treat the idempotency key as the report's identity.** Store it, and answer a repeat with success without storing the report twice.
- **Optionally return an id**, such as `{ "id": "evt_123" }`, for the receipt's `event.id`.
- **Validate the body.** It comes from a client, so treat it as untrusted input like any other request.

## Reports and accounts

Your client authenticates as whoever is signed in when it sends. A report whose user has signed out or switched accounts since it was captured, for example one held in the startup buffer, is skipped as `auth-subject-mismatch` before `request` is called, so a report is never sent with the credentials of an account that signed in after it was captured. An anonymous report is sent.

The adapter checks before it calls `request`. If your client fetches a token first, an account change during that wait is your client's to handle.

## What it does not do

There is no retry, no queue and no offline storage in the adapter. A report is sent once, and the receipt says what happened. If you need retries, build them into your client, where the idempotency key makes them safe.
