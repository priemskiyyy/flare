---
description: "Use Flare in Solid: publish it with a provider, report what Solid's ErrorBoundary catches, and read status with primitives that start nothing."
---

# Solid

`@priemskiyyy/flare-solid` is a provider, an error boundary and status primitives, for Solid 1.9 or newer. It is deliberately thin: you report with `flare.capture`, which needs no primitive.

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-solid
```

## Set it up

Create and start the Flare outside Solid, then publish it:

<!-- snippet: fragment -->

```tsx
<FlareProvider flare={flare}>
  <FlareErrorBoundary
    fallback={({ reset }) => <button onClick={reset}>Try again</button>}
    capture={{ tags: { area: "cart" } }}
  >
    <Cart />
  </FlareErrorBoundary>
</FlareProvider>
```

The provider owns no lifetime. Mounting it starts nothing, and unmounting it disposes nothing.

## Primitives

```ts
import {
  useDestinationStatus,
  useFlare,
  useFlareStatus,
} from "@priemskiyyy/flare-solid";

const flare = useFlare();
const status = useFlareStatus();
const sentry = useDestinationStatus("sentry");

const handleSaveClick = () => save().catch(flare().capture);
```

`useFlare()` is an accessor of the provider's Flare. The status primitives are accessors that only observe. On the server and until the component is mounted they read `idle`. `useDestinationStatus` also takes an accessor, and follows a name that changes.

## What the boundary sees

It wraps Solid's own `ErrorBoundary`, so it sees errors thrown while rendering and inside reactive computations. It does not see errors in event handlers, or in asynchronous code outside a computation. Report those with `flare().capture`. Solid has no component stack, so the report carries only what `capture` gives it.

With server rendering, Solid's boundary catches on the server too. The error is reported through the server's Flare, and again through the client's while hydrating, because Solid replays it there. See [server rendering](server-rendering.md).

## Type it once

<!-- snippet: fragment -->

```ts
declare module "@priemskiyyy/flare-solid" {
  interface Register {
    flare: typeof flare;
  }
}
```

The [package README](https://github.com/priemskiyyy/flare/tree/main/packages/solid#readme) is the full reference. For the inspector, see [devtools](devtools.md).
