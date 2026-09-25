# Security

Report a vulnerability privately through [GitHub's private vulnerability reporting](https://github.com/priemskiyyy/flare/security/advisories/new), not in a public issue. Include the package and its version, the destinations and options involved, and the smallest example that shows the problem, with DSNs, API keys, access tokens and personal data removed.

Fixes go into the latest release of each package, as a new patch version with its changelog entry. The advisory is published once that release is on npm.

Flare redacts what it can see before any destination receives a report, and the thrown value itself never leaves the core. What a provider stores once it holds a report is up to that provider's SDK and account settings; see the [privacy guide](docs/privacy.md).
