---
description: "Ledger, an invoicing app for two companies, shows where each Flare error report goes: five destinations, redaction, receipts, a fault lab and the diagnostics timeline, all inside the page."
---

<script setup>
import { withBase } from "vitepress";
</script>

# Example application

Ledger is an invoicing app for two companies. Pay an invoice, send a reminder, attach a receipt or break the invoice preview, and follow each report: redacted before any destination sees it, routed to the destinations that should have it, and settled with an outcome for each one.

Every destination is a real Flare adapter: your API through `@priemskiyyy/flare-http`, the console, and Sentry, PostHog and Datadog over SDKs simulated in the page. Nothing leaves your browser, and no provider account is needed.

<img :src="withBase('/images/screenshots/ledger.png')" alt="Ledger with Ada Lovelace signed in at Acme: two invoices beside the latest report, a declined payment that your API, the console and Sentry received and that routing kept from PostHog and Datadog" />

## Run it

There is no hosted demo. From the repository root:

```sh
pnpm install
pnpm build
pnpm --filter example-react dev
```

The example uses the built packages, so build them first.

## The tour

The page walks through five sections, each with a "Try this" hint:

1. **Make something fail.** Ledger opens signed in as Ada at Acme, and every button fails on purpose: paying declines the card, a reminder bounces, the upload times out, and breaking the preview throws while rendering. The report appears beside the app under **Latest report**, with every destination, what it answered and why, and the name Flare's API gives that answer. A destination that routing left out shows as **Not routed**. **What every destination received** opens the report as it was sent, with each value Flare hid highlighted.
2. **Every report, accounted for.** Every receipt stays listed and opens to the same detail, above a legend of what each answer means. An upload started as Ada and finished as Grace is dropped as `stale-scope` rather than charged to Grace.
3. **One report, five destinations.** Billing reports go only to your API, Sentry and the console. Everything else goes to Sentry, PostHog, Datadog and the console. A reminder is a message, which PostHog and Datadog skip as `unsupported-report-kind`, and its email address arrives scrubbed. **Flush** shows how far each destination's own flush got.
4. **Break the destinations.** Slow your API past the 3 second timeout and its outcome is `indeterminate`, not `failed`. Take it offline and only its outcome fails. Make PostHog's own filters drop every event, report the same error twice, or restart with Sentry uninitialized and watch its reports wait for a retried start.
5. **Watch it happen.** The timeline is Flare's diagnostics stream, in words: destinations opening, reports accepted and each answer, with no report content. Restart without starting, pay, then press **Start**: the report waited in the buffer.

**Reset demo** in the header starts over. The devtools button in the corner opens [Flare's own inspector](devtools.md) over the same runtime.

## What it configures

`examples/shared/ledger/reporting/createLedgerFlare.ts` holds all of Ledger's reporting, with its schema and privacy rules beside it in `constants/`:

- a [`defaults.to`](routing.md) function that sends reports tagged `area: "billing"` to your API, Sentry and the console, and everything else elsewhere
- a Zod [schema](metadata.md#typing-them) for its tags, contexts and breadcrumbs, including the `react` context the error boundary adds
- [`redact`](privacy.md) that keeps the defaults and adds the IBAN, and a `scrub` that replaces email addresses
- a `timeout` of 3000 ms, short enough for the lab's slow API to end unconfirmed

To use a real provider, swap a simulated SDK for the one your application initializes, such as `sentry({ sdk: Sentry })` after `Sentry.init`, and give the HTTP adapter a `request` over your own API client. Nothing else in the app changes. The [example's README](https://github.com/priemskiyyy/flare/tree/main/examples/react#readme) maps each part of the page to its source.

## Tests

`pnpm test:unit` runs the example's tests in jsdom with the rest of the workspace. They start Ledger the way the page does and drive the flows through the buttons, with a fresh backend and runtime per test: routing, including a destination it leaves out, redaction and the payload's highlights, skipped messages, the error boundary, a stale scope, an offline or slow API, account isolation, the startup buffer, dedupe and the timeline's wording.

`pnpm test:examples` builds the packages and drives the built page in Chromium with Playwright (`examples/ledger.spec.ts`). At 375 and 1280 px wide, a payment settles with no page errors and no horizontal scroll, reaching your API and leaving PostHog out. It also checks that the payload shows the card token and the IBAN as `[Redacted]` and marks both, that an upload outliving an account switch is dropped as `stale-scope`, that **Reset demo** starts over signed in as Ada, and that the devtools open and list all five destinations. It is not part of `pnpm check`.
