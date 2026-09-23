# Ledger on Solid

The Ledger invoicing app from the [React example](../react), rebuilt with `@priemskiyyy/flare-solid`. It reports through the same Flare, to the same five destinations over the same simulated SDKs, so paying an invoice, sending a reminder, attaching a receipt or breaking the preview settles each report exactly as it does in React. Nothing leaves your browser.

```sh
pnpm install
pnpm build
pnpm --filter example-solid dev
```

The packages are linked from the workspace, so build them first.

## How it uses the binding

`src/types/Register.d.ts` registers Ledger's Flare once, and `Application.tsx` publishes it with `<FlareProvider flare={props.runtime.flare}>`. Below it no component receives the Flare as a prop:

- the invoice rows, the upload and the status bar read it with `useFlare()`, an accessor, and call `flare().capture`, `flare().message` and `flare().scope` from their handlers
- the header's badge reads `useFlareStatus()`, so it says **Started** once the runtime has started
- each row of the latest report reads its destination with `useDestinationStatus(() => props.destination)`
- the preview is wrapped in `FlareErrorBoundary`, which reports the render error and hands its receipt to `onError`

<!-- snippet: fragment -->

```tsx
<FlareErrorBoundary
  capture={{ tags: { area: "preview" } }}
  onError={({ receipt }) => props.onReceipt(receipt, "Render the preview")}
  fallback={({ reset }) => <button onClick={reset}>Reset the preview</button>}
>
  <InvoiceDocument isBroken={isBroken()} />
</FlareErrorBoundary>
```

Solid's boundary sees errors thrown while rendering and inside computations, not in event handlers, so the broken document throws from a memo. The payment and the reminder report from their handlers with `flare().capture` and `flare().message` instead.

`main.tsx` starts Ledger once, outside Solid, with `startLedger` from `examples/shared`, and renders the application. The Flare configuration, the backend, the simulated SDKs, the wording of every outcome and the Tailwind recipes come from `examples/shared`, so the components here are the only Solid-specific part. `src/primitives/useExternalStore.ts` reads the receipts log and each receipt's status as accessors. The devtools button in the corner opens Flare's inspector over the same runtime, mounted by `FlareDevtools` from `@priemskiyyy/flare-devtools/solid`.

## Tests

`pnpm vitest run --project example-solid` starts Ledger the way the page does, with a fresh runtime per test, and drives it through its buttons: the signed-in start, a payment's routing, the error boundary and its reset, an upload dropped as `stale-scope` after an account switch, and unmounting, which leaves the Flare to the host. `pnpm test:examples` also drives the built page in Chromium (`../frameworks.spec.ts`) at phone and desktop widths. Run `pnpm --filter example-solid lint:typescript` to typecheck it.
