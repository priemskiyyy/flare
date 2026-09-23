# Ledger on Vue

The Ledger app from the [React example](../react), rebuilt with [`@priemskiyyy/flare-vue`](../../packages/vue). It runs on the same Flare, the same five destinations and the same simulated SDKs from `examples/shared`, so a payment is routed to your API, Sentry and the console, a broken preview is reported by the error boundary, and an upload that outlives an account switch is dropped as `stale-scope`, exactly as in React. Nothing leaves your browser.

```sh
pnpm install
pnpm build
pnpm --filter example-vue dev
```

The packages are linked from the workspace, so build them first.

`src/types/Register.d.ts` registers Ledger's Flare once, and `Application.vue` publishes it with `FlareProvider`. From there no component receives the Flare as a prop:

```vue
<script setup lang="ts">
import { FlareErrorBoundary, useFlare } from "@priemskiyyy/flare-vue";

const flare = useFlare();

const handlePayClick = () => {
  flare.value.capture(new Error("The card was declined"), {
    tags: { area: "billing" },
  });
};
</script>

<template>
  <button type="button" @click="handlePayClick">Pay</button>
  <FlareErrorBoundary :capture="{ tags: { area: 'preview' } }">
    <InvoiceDocument />
    <template #fallback="{ reset }">
      <button type="button" @click="reset">Reset the preview</button>
    </template>
  </FlareErrorBoundary>
</template>
```

The header's badge reads `useFlareStatus()`, each row of the latest report reads its destination with `useDestinationStatus(() => props.destination)`, and the devtools come from `@priemskiyyy/flare-devtools/vue`. The boundary adds where Vue caught the error as the `vue` context, which Ledger's shared schema declares.

| File                                  | Role                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/main.ts`                         | Starts Ledger once with the shared `startLedger`, outside Vue, and mounts it.             |
| `src/Application.vue`                 | The provider, the signed-in account, the flush when the page is hidden, and the devtools. |
| `src/components/Ledger/`              | The product: capture, message, a scope, and `FlareErrorBoundary`.                         |
| `src/components/Report/`              | The latest report: every destination, its status, what it answered and why.               |
| `src/composables/useExternalStore.ts` | Reads the receipts, a receipt's status and the diagnostics into refs.                     |
| `src/Application.test.ts`             | The flows driven through the buttons, with a fresh backend and runtime per test.          |

The domain, the Flare configuration and the Tailwind recipes come from `examples/shared`, so the markup is the only Vue-specific part. The React example alone has the tour: the payload view, every receipt, the destinations, the lab and the timeline.

## Tests

`pnpm vitest run --project example-vue` runs the example's tests in jsdom against the built packages. `pnpm test:examples` builds it and drives the built page in Chromium with Playwright (`../frameworks.spec.ts`), at 375 and 1280 px, with no page errors and no horizontal scroll.
