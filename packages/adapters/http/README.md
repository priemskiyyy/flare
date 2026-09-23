# @priemskiyyy/flare-http

Send [Flare](../../core) error reports to your own backend, through your own client. You give the adapter one function that sends a report, and your client keeps everything it already owns: the address, authentication, headers, retries and response handling.

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-http
```

## Create a Flare

```ts
import { Flare } from "@priemskiyyy/flare";
import { http } from "@priemskiyyy/flare-http";

const flare = new Flare({
  destinations: {
    backend: http({
      request: async ({ report, signal }) => {
        const response = await fetch("https://api.example.com/error-reports", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": report.id,
            authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify(report),
          signal,
        });

        if (!response.ok) {
          throw new Error(
            `The error report endpoint answered ${response.status}.`,
          );
        }
      },
    }),
  },
});

flare.start();
```

## The request

`request({ report, signal })` sends one report and answers for it:

| `request` does                                               | The receipt says                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------- |
| resolves with nothing, once your backend accepted the report | `submitted`, `backend-acknowledged`, `event: null`                |
| resolves with `{ id }`, the backend's reference for it       | `submitted`, `backend-acknowledged`, `event: { id }`              |
| throws or rejects                                            | `failed`, with your error                                         |
| outlives `timeout`                                           | `indeterminate`: `signal` aborts, and the report may have arrived |

- `report` is the frozen, sanitized report, and `JSON.stringify(report)` is its wire form: `id`, `timestamp`, `level`, `kind`, `exception` or `message`, `identity`, `tags`, `contexts`, `breadcrumbs`, `operation` and `losses`.
- Send `report.id` as the idempotency key, and have the backend answer a repeated key with its first result, so a report that arrives twice is recorded once.
- Pass `signal` on, so a request past the deadline or the Flare's disposal stops.

## Options

| Option    | Default  | Meaning                                                   |
| --------- | -------- | --------------------------------------------------------- |
| `request` | required | Sends one report through your client, as described above. |

## Behavior

- Platforms: anywhere your client runs, browsers, React Native, Node and edge runtimes alike. There is no SDK and nothing to initialize.
- Evidence is `backend-acknowledged`. It rests on your `request` resolving only once your backend accepted this exact report: a client that resolves before the answer arrives claims more than it knows.
- Identity: your client authenticates as whoever is signed in now. A report with a user whose account has changed since it was captured, for example one held in the startup buffer while its user signed out or switched accounts, is skipped as `auth-subject-mismatch`, so one account's report is never sent with another's credentials. An anonymous report is sent. The adapter checks before it calls `request`; an account change while your client is still fetching a token is your client's to handle.
- Mapping: nothing is lost. The report is yours to send whole, and `losses` is always empty.
- Privacy: the report was redacted, scrubbed and bounded by the core. What your client adds, such as headers, is yours.
- A report is sent once: there is no retry, no queue and no offline storage in the adapter. Retry in your client if you need to; the idempotency key makes that safe.
- There is no automatic capture and no `flush`: every submission awaits its own request, so `flare.flush()` drains this destination and reports its boundary as `unsupported`.
- `native` is the `request` you passed.

## Tests

The tests run against an in-process fake client injected through `request`. No request is sent over a network from this repository.

## License

[MIT](LICENSE)
