# Example applications

Every example is the same product: Ledger, an invoicing app for two companies. Every button fails on purpose: paying declines the card, a reminder bounces, an upload times out and breaking the preview throws while rendering. Each failure becomes one report, which Flare redacts, routes to the destinations that should have it and settles with an outcome for each one.

Run `pnpm build` from the repository root first. The examples import the built public packages.

| Example          | Run                                | What it shows                                                                                                        |
| ---------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [React](react)   | `pnpm --filter example-react dev`  | The full tour: the payload each destination received, every receipt, a lab that breaks the destinations, a timeline. |
| [Vue](vue)       | `pnpm --filter example-vue dev`    | Ledger with `FlareProvider`, `FlareErrorBoundary` and composables.                                                   |
| [Solid](solid)   | `pnpm --filter example-solid dev`  | Ledger with `FlareProvider`, `FlareErrorBoundary` and accessors.                                                     |
| [Svelte](svelte) | `pnpm --filter example-svelte dev` | Ledger with `FlareProvider`, `FlareErrorBoundary` and utilities read through `current`.                              |
| [Expo](expo)     | `pnpm --filter example-expo dev`   | A React Native Ledger that reports over HTTP to the fixture server, and flushes when the app goes to the background. |

Each web example creates and starts its Flare outside the framework, publishes it with the binding's provider and reports with `flare.capture` and `flare.message`. The error boundary reports a broken preview, and the header's badge reads `useFlareStatus()`. The Vue, Solid and Svelte examples show the latest report beside the app, each destination with its status and its answer, and mount the devtools through their binding's wrapper. The React example adds everything else the page can show.

## Shared code

`examples/shared` is the `example-shared` workspace package:

- `ledger/` holds the domain: the accounts and invoices, your API with its latency and outages, the simulated Sentry, PostHog and Datadog SDKs, the Flare configuration with its schema and privacy rules, the runtime that keeps the receipts and the timeline, and every outcome in words.
- `ui/` holds the Tailwind theme, the class recipes and the Phosphor icons that the Vue, Solid and Svelte examples draw as CSS masks.

The web examples run everything inside the page, so they need no provider account and send nothing over the network.

## Fixture server

`pnpm dev:server` builds and starts `examples/server` on port 4388. It accepts reports on `POST /api/reports`, answering a report it already accepted with its first answer, and changes how it answers on `POST /api/control`, validating both bodies with Zod. The permissive CORS and the open control endpoint are there for local development only.

## Tests

`pnpm vitest run --project example-react` and the matching `example-vue`, `example-solid`, `example-svelte` and `example-server` projects run the unit tests, which `pnpm test:unit` includes. `pnpm test:examples` builds the four web examples and drives them in Chromium with Playwright at phone and desktop widths. The Expo app is typechecked by `pnpm lint:typescript` and bundled for web, iOS and Android by `pnpm check:release`; nothing here runs it on a device.
