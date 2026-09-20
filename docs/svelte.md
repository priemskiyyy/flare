---
description: "Use Flare in Svelte 5: publish it with a provider, report what svelte:boundary catches, and read status with utilities that start nothing."
---

# Svelte

`@priemskiyyy/flare-svelte` is a provider, an error boundary and status utilities, for Svelte 5.7 or newer. It ships Svelte sources, so your application's own Svelte compiles it. It is deliberately thin: you report with `flare.capture`, which needs no utility.

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-svelte
```

## Set it up

Create and start the Flare outside Svelte, then publish it:

```svelte
<script lang="ts">
  import { FlareErrorBoundary, FlareProvider } from "@priemskiyyy/flare-svelte";
  import { flare } from "./flare";
</script>

<FlareProvider {flare}>
  <FlareErrorBoundary capture={{ tags: { area: "cart" } }}>
    <Cart />
    {#snippet fallback({ reset })}
      <button type="button" onclick={reset}>Try again</button>
    {/snippet}
  </FlareErrorBoundary>
</FlareProvider>
```

The provider owns no lifetime. Mounting it starts nothing, and unmounting it disposes nothing.

## Utilities

Call them while a component is being created, like any context reader:

```ts
import {
  useDestinationStatus,
  useFlare,
  useFlareStatus,
} from "@priemskiyyy/flare-svelte";

const flare = useFlare();
const status = useFlareStatus();
const sentry = useDestinationStatus("sentry");

const handleSaveClick = () => save().catch(flare.current.capture);
```

Each returns an object read through `current`. The status utilities only observe. On the server and until the component is mounted they read `idle`, so hydration never mismatches. `useDestinationStatus` also takes a getter, and follows a name that changes.

## What the boundary sees

It wraps `svelte:boundary`, so it sees errors thrown while rendering and inside effects. It does not see errors in event handlers or in asynchronous code. Report those with `flare.current.capture`. Svelte has no component stack, so the report carries only what `capture` gives it.

On the server a Svelte boundary catches nothing. See [server rendering](server-rendering.md).

## Type it once

```ts
declare module "@priemskiyyy/flare-svelte" {
  interface Register {
    flare: typeof flare;
  }
}
```

The [package README](https://github.com/priemskiyyy/flare/tree/main/packages/svelte#readme) is the full reference. For the inspector, see [devtools](devtools.md).
