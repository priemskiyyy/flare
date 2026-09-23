# Ledger, a Flare example

Ledger is an invoicing app for two companies, built to show where each [Flare](../../README.md) error report goes. Every destination is a real Flare adapter: your API over `@priemskiyyy/flare-http`, the console, and Sentry, PostHog and Datadog over SDKs simulated in the page. Nothing leaves your browser, and no provider account is needed.

```sh
pnpm install
pnpm build
pnpm --filter example-react dev
```

The packages are linked from the workspace, so build them first.

## The tour

The page walks through five sections, each with a "Try this" hint:

1. **Make something fail.** Ledger opens signed in as Ada at Acme, and every button fails on purpose: paying declines the card, a reminder bounces, the upload times out, and breaking the preview throws while rendering. The report appears beside the app under **Latest report**, with every destination, what it answered and why, and the name Flare's API gives that answer. A destination that routing left out shows as **Not routed**. **What every destination received** opens the report as it was sent, with each value Flare hid highlighted.
2. **Every report, accounted for.** Every receipt stays listed and opens to the same detail, above a legend of what each answer means. An upload started as Ada and finished as Grace is dropped as `stale-scope` rather than charged to Grace.
3. **One report, five destinations.** Billing reports go only to your API, Sentry and the console. Everything else goes to Sentry, PostHog, Datadog and the console. A reminder is a message, which PostHog and Datadog skip as `unsupported-report-kind`, and its email address arrives scrubbed. **Flush** shows how far each destination's own flush got.
4. **Break the destinations.** Slow your API past the 3 second timeout and its outcome is `indeterminate`, not `failed`. Take it offline and only its outcome fails. Make PostHog's own filters drop every event, report the same error twice, or restart with Sentry uninitialized and watch its reports wait for a retried start.
5. **Watch it happen.** The timeline is Flare's diagnostics stream, in words: destinations opening, reports accepted and each answer, with no report content. Restart without starting, pay, then press **Start**: the report waited in the buffer.

**Reset demo** in the header starts over. The devtools button in the corner opens Flare's own inspector over the same runtime.

## How it fits together

| File                                    | Role                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/main.tsx`                          | Starts Ledger once, outside React, and renders it.                                                |
| `src/utils/startLedger.ts`              | Creates the backend, the SDKs and the first runtime, signs Ada in and starts it, as the tests do. |
| `src/reporting/createLedgerFlare.ts`    | The destinations, `defaults.to`, the Zod schema, redaction, scrubbing and the timeout.            |
| `src/reporting/createLedgerRuntime.ts`  | One Flare with its receipts, console lines and diagnostics timeline. A restart is a new one.      |
| `src/backend/createReportBackend.ts`    | Your API and its client: latency, an outage, a single failure, and the network log.               |
| `src/providers/`                        | The simulated Sentry, PostHog and Datadog SDKs, each typed with its adapter's `*Like` type.       |
| `src/utils/switchAccount.ts`            | What the app does on sign-in: PostHog and Datadog get the user too, as they need.                 |
| `src/components/Ledger/`                | The product: capture, message, a scope, and `FlareErrorBoundary`.                                 |
| `src/components/Report/`                | The latest report and each receipt's detail: every destination's answer, and the payload.         |
| `src/formatting/`                       | Outcomes, drop reasons and diagnostic events in plain words.                                      |
| `src/components/Receipts/`, `Timeline/` | Observable receipts and diagnostics, read with `useSyncExternalStore`.                            |
| `src/Application.test.tsx`              | The flows driven through the buttons, with a fresh backend and runtime per test.                  |

Styling is Tailwind with a few `class-variance-authority` recipes in `src/styles/`, and icons come from Phosphor, as in the sibling libraries' examples.

## Using a real provider

Swap a simulated SDK for the real one the application initializes, such as `sentry({ sdk: Sentry })` after `Sentry.init`, and give the HTTP adapter a `request` over your own API client. Nothing else in the app changes.

## Tests

`pnpm test:unit` runs the example's tests in jsdom against the built packages. They start Ledger the way the page does and drive the flows through the buttons, with a fresh backend and runtime per test: routing, including a destination it leaves out, redaction and the payload's highlights, skipped messages, the error boundary, a stale scope, an offline or slow API, account isolation, the startup buffer, dedupe and the timeline's wording.

`pnpm test:examples` builds the packages and drives the built page in Chromium with Playwright (`../ledger.spec.ts`). At 375 and 1280 px wide, a payment settles with no page errors and no horizontal scroll, reaching your API and leaving PostHog out. It also checks that the payload shows the card token and the IBAN as `[Redacted]` and marks both, that an upload outliving an account switch is dropped as `stale-scope`, that **Reset demo** starts over signed in as Ada, and that the devtools open and list all five destinations. It is not part of `pnpm check`.
