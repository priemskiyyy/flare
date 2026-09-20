---
description: "Use Flare in Vue: publish it with a provider, report what Vue's error capture sees with an error boundary, and read status with composables that start nothing."
---

# Vue

`@priemskiyyy/flare-vue` is a provider, an error boundary and status composables, for Vue 3.5 or newer. It is deliberately thin: you report with `flare.capture`, which needs no composable.

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-vue
```

## Set it up

Create and start the Flare outside Vue, then publish it:

```vue
<script setup lang="ts">
import { FlareErrorBoundary, FlareProvider } from "@priemskiyyy/flare-vue";
import { flare } from "./flare";
</script>

<template>
  <FlareProvider :flare="flare">
    <FlareErrorBoundary :capture="{ tags: { area: 'cart' } }">
      <Cart />
      <template #fallback="{ reset }">
        <button type="button" @click="reset">Try again</button>
      </template>
    </FlareErrorBoundary>
  </FlareProvider>
</template>
```

The provider owns no lifetime. Mounting it starts nothing, and unmounting it disposes nothing.

## Composables

```ts
import {
  useDestinationStatus,
  useFlare,
  useFlareStatus,
} from "@priemskiyyy/flare-vue";

const flare = useFlare();
const status = useFlareStatus();
const sentry = useDestinationStatus("sentry");

const handleSaveClick = () => save().catch(flare.value.capture);
```

`useFlare()` is a computed ref of the provider's Flare. The status composables are read-only refs that only observe. On the server and until the component is mounted they read `idle`, so hydration never mismatches. `useDestinationStatus` also takes a ref or a getter, and follows a name that changes.

## What the boundary sees

Vue's error capture is wider than React's. The boundary reports render errors, and also errors thrown by event handlers, watchers and lifecycle hooks in the tree below it. It adds where Vue caught the error as the `vue` context.

A captured error stops at the boundary and does not reach `app.config.errorHandler`. If your provider SDK's Vue integration installs that handler, the error is therefore reported once, by Flare. On the server the boundary reports too, but renders nothing in place of the failed tree. See [server rendering](server-rendering.md). Errors outside any boundary still reach that handler, and whoever owns it reports them. See [automatic capture ownership](automatic-capture.md).

## Type it once

```ts
declare module "@priemskiyyy/flare-vue" {
  interface Register {
    flare: typeof flare;
  }
}
```

The [package README](https://github.com/priemskiyyy/flare/tree/main/packages/vue#readme) is the full reference. For the inspector, see [devtools](devtools.md).
