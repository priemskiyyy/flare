# Getting help

Start with [getting started](docs/getting-started.md), the [troubleshooting guide](docs/troubleshooting.md) and the [provider limitations](docs/provider-limitations.md). Each adapter has its own README under [packages/adapters](packages/adapters), and the [devtools](docs/devtools.md) show what happened to every report.

For a bug report, include:

- The smallest example that reproduces the issue, ideally over the mock adapter from `@priemskiyyy/flare/mock`.
- Flare, adapter, provider SDK, framework and runtime versions, and the platform: browser, Node, React Native or Expo.
- The Flare options involved: the destinations, `defaults`, and any `schema`, `privacy`, `buffer`, `timeout`, `dedupe` or `rateLimits`.
- The receipt of the report in question, from `await receipt.settled`, including each destination's outcome, evidence and losses.
- Each destination's status, from `flare.destination(name).status.get()`, and the `code` of a `FlareError` it holds.
- The devtools timeline for the report, if the application mounts them.
- Whether it happens before `start()`, across a sign-in or sign-out, during `flush()` or after `dispose()`.

Use [GitHub issues](https://github.com/priemskiyyy/flare/issues) for reproducible bugs and feature requests. Report a security issue privately instead, as [SECURITY.md](SECURITY.md) describes. Remove DSNs, API keys, access tokens and personal data from examples, receipts and logs. Diagnostics and the devtools timeline carry no report content, so they are safe to share as they are.

If a report reached a provider but looks wrong there, check first whether the provider's own SDK produces the same result without Flare. Grouping, symbolication, sampling and quotas are the provider's.

See [CONTRIBUTING.md](CONTRIBUTING.md) to run the test suites or propose a change.
