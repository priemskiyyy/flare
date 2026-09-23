# Ledger on Svelte

Ledger from the [React example](../react), rebuilt with `@priemskiyyy/flare-svelte` and Svelte 5 runes. It runs on the same Flare, with the same five destinations, your API and the simulated SDKs, so a payment, a reminder, an upload and a broken preview are routed, redacted and answered exactly as they are in React.

```sh
pnpm build
pnpm --filter example-svelte dev
```

`src/types/Register.d.ts` registers Ledger's Flare once, and `Application.svelte` publishes it with `FlareProvider`. From there every component reads it with `useFlare()` while it initializes, and reports with the types the schema declared:

```svelte
<script lang="ts">
  import { useFlare } from "@priemskiyyy/flare-svelte";

  const flare = useFlare();

  const handlePayPress = () => {
    flare.current.capture(new Error("The card was declined"), {
      tags: { area: "billing" },
    });
  };
</script>

<button type="button" onclick={handlePayPress}>Pay</button>
```

The preview sits in a `FlareErrorBoundary`, whose `fallback` snippet offers a reset. It wraps `svelte:boundary`, so it sees what the preview throws while rendering, not what a click handler throws; the buttons report those themselves. The header's badge uses `useFlareStatus()`, and each row of the latest report adds its destination's status with `useDestinationStatus()`. The devtools mount through the `createDevtools()` attachment, inside the provider.

`main.ts` starts Ledger once, outside Svelte, with `startLedger` from `examples/shared`, and mounts the application. The Flare, the backend, the simulated SDKs, the formatting and the Tailwind recipes all come from `examples/shared`, so the markup here is the only Svelte-specific part. The receipts and each receipt's status are external stores, read through `current` with `createSubscriber` in `src/utilities/useExternalStore.ts`.

## Tests

`pnpm vitest run --project example-svelte` mounts the application the way the page does, with a fresh runtime per test: a payment reaches your API, Sentry and the console while PostHog and Datadog are not routed, the boundary reports a broken preview and resets, an upload that outlives an account switch is dropped as `stale-scope`, and unmounting leaves the Flare running. `pnpm test:examples` drives the built page in Chromium at phone and desktop widths. Run `pnpm --filter example-svelte lint:typescript` to typecheck it.
