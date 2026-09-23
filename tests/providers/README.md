# Provider transport tests

The adapter tests run against in-process fakes. These run the real provider SDKs instead, with their own transports, against HTTP receivers on random loopback ports, and read what arrived. No Docker, no provider account and no credentials are needed, and nothing leaves the machine.

```sh
pnpm build
pnpm test:providers
```

They import the built packages, so build first. They are part of `pnpm check` and of the package CI on Node 22 and 24.

## Coverage

| Destination | Real code                                                   | What is checked on the wire                                                                                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HTTP        | `@priemskiyyy/flare-http` over `fetch`, as its README shows | The report arrives once, whole and redacted, under its id as the idempotency key; the answered id is the receipt's event. A 503 is `failed`. A server slower than the deadline is `indeterminate`, and the request is abandoned.                             |
| Sentry      | `@sentry/browser` and its fetch transport                   | The envelope's event carries the exception, level, user, tags, contexts and breadcrumbs, redacted, under the event id the receipt names. A message is a message event at its level. `flare.flush()` returns only once the transport has the server's answer. |
| PostHog     | `posthog-js` in jsdom                                       | The `$exception` event carries the report, redacted, under the person the SDK identified and the uuid the receipt names. An event `before_send` drops is `dropped` as `provider-filtered` and never sent.                                                    |
| Bugsnag     | The `@bugsnag/js` browser notifier in jsdom                 | A report is `submitted` only once the server has answered the delivery, and carries the exception, user and metadata, redacted. A delivery the server refuses is `failed`.                                                                                   |

The receivers answer as a provider's ingestion endpoint would, allow cross-origin requests for the SDKs that run in jsdom, and record a request whose client hung up before it was answered. A negative assertion waits for a later event as a barrier rather than for time to pass.

## Limits

- The receivers accept what the SDKs send; they do not validate it the way Sentry, PostHog or Bugsnag ingestion does. A payload these providers would reject can still pass here.
- Datadog is not covered: its browser SDK does not start outside a browser. `posthog-react-native`, `@bugsnag/react-native`, `@sentry/react-native` and `@datadog/mobile-react-native` need a React Native runtime.
- jsdom is not a browser. Page unload and `sendBeacon` are not exercised.
