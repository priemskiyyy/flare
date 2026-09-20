# @priemskiyyy/flare-http

Send [Flare](../../core) error reports to your own backend. Each report is posted once as JSON, with its id as the idempotency key and the backend's `2xx` answer as evidence.

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
      endpoint: "https://api.example.com/error-reports",
      authorize: () => ({ authorization: `Bearer ${session.token}` }),
    }),
  },
});

flare.start();
```

## Server contract

| Request                                                                                                        | Answer                                                                      |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `POST {endpoint}` with `Content-Type: application/json`, `Idempotency-Key: {report id}` and the report as body | any `2xx`. A JSON body with a string `id` becomes the receipt's `event.id`. |

The body is the sanitized report: `id`, `timestamp`, `level`, `kind`, `exception` or `message`, `identity`, `tags`, `contexts`, `breadcrumbs`, `operation` and `losses`. Store the idempotency key and answer a repeated key with the first result, so a report delivered twice is recorded once.

Any other status is a `failed` outcome whose error names the status. A network failure from `fetch` is a `failed` outcome carrying that error.

## Options

| Option      | Default            | Meaning                                                                                                                    |
| ----------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `endpoint`  | required           | Where each report is posted.                                                                                               |
| `headers`   | none               | Headers for every request, or a function answering them per request, awaited. Not for credentials.                         |
| `authorize` | none               | Answers the credentials of the current account, as headers. Asked only while the report still belongs to that account.     |
| `fetch`     | `globalThis.fetch` | Read when a report is sent, so a polyfill installed later is honoured. Anything with the shape of `FetchLike` is accepted. |

## Behavior

- Platforms: browsers, React Native, Node 18 or newer, and edge runtimes. There is no SDK and nothing to initialize, so ownership does not apply. Without a reachable `fetch` the destination is `unavailable`.
- Identity: a report carries the identity generation it was captured under. With `authorize` set, a report whose generation is no longer current is skipped as `auth-subject-mismatch`, before and again after the credentials are fetched. Account A's buffered report is therefore never sent with account B's credentials. Without `authorize` there are no credentials to cross, and a buffered report is sent under its own identity.
- Mapping: nothing is lost. The report is the request body, and `losses` is always empty.
- Privacy: the body was redacted, scrubbed and bounded by the core. The reporter adds the headers you configure and nothing else.
- Evidence is `backend-acknowledged`: your backend answered `2xx` for this exact report. What the backend does afterwards is its own guarantee.
- A report is sent once. There is no retry, no queue, no connectivity handling and no offline storage. A deadline aborts the request through its `signal` and leaves the outcome `indeterminate`, because the backend may already have received it; the idempotency key is what makes a later resend by your own code safe.
- There is no automatic capture and no `flush`: every submission awaits its own response, so `flare.flush()` drains this destination and reports its boundary as `unsupported`.
- `native` is `{ endpoint }`.
- Tests run against an in-process fake backend whose `fetch` is injected through the public option and answers with real `Response` objects. No real backend is contacted.

## License

[MIT](LICENSE)
