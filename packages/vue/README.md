# @priemskiyyy/flare-vue

Vue bindings for [Flare](../core): a provider, status composables and an error boundary. They are deliberately thin. Reports are made with `flare.capture`, which needs no composable, and the bindings never start, stop or dispose anything.

Works in Vue 3.5 or newer.

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-vue
```

## Set it up

Create and start the Flare outside Vue, as early as your application allows, then publish it:

```ts
import { Flare } from "@priemskiyyy/flare";
import { consoleReporter } from "@priemskiyyy/flare-console";

export const flare = new Flare({
  destinations: { console: consoleReporter() },
});

flare.start();
```

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

## Type it once

Register your Flare, and every composable and the boundary know its destination names and its schema:

```ts
declare module "@priemskiyyy/flare-vue" {
  interface Register {
    flare: typeof flare;
  }
}
```

Without it everything still works, with destination names typed as `string`.

## Composables

```ts
import {
  useDestinationStatus,
  useFlare,
  useFlareStatus,
} from "@priemskiyyy/flare-vue";

const flare = useFlare(); // ComputedRef of the provider's Flare
const status = useFlareStatus(); // { state: "idle" | "started" | "disposed" }
const sentry = useDestinationStatus("sentry");

const handleSaveClick = () => save().catch(flare.value.capture);
```

- `useFlare()` follows the provider, and throws `Flare composables must be used within a FlareProvider.` when there is none.
- `useDestinationStatus(name)` accepts a string, a ref or a getter, and follows a name that changes. `ready` means locally usable, not that a network is reachable.
- Both status composables return read-only refs and accept an optional callback that is told about later changes.
- They observe only. Using them starts nothing, opens no destination and creates no report.
- On the server and until the component is mounted they read `idle`, so server markup and the hydrating render always match, even when the client started Flare first.

## FlareErrorBoundary

| Part            | Meaning                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| default slot    | The tree to guard.                                                                        |
| `fallback` slot | Rendered instead, with `{ error, reset }`. `reset` renders the default slot again.        |
| `capture` prop  | Options for the report: `tags`, `contexts`, `level`, `operation`, `to`, `user`, `dedupe`. |
| `onError` prop  | Told after the report is made, with the `error` and the report's `receipt`.               |

It reports each captured error once and adds where Vue caught it as the `vue` context, such as `{ info: "render function" }`. In a production build Vue passes a link into its error reference instead of that text, such as `https://vuejs.org/error-reference/#runtime-1`. With a typed schema, declare that context or it is dropped and recorded as a loss.

Vue's error capture is wider than React's. Besides render errors, it sees errors thrown by event handlers, watchers and lifecycle hooks in the tree below, so the boundary reports those too and shows its fallback. What it does not see is asynchronous code after an `await`, and an error in its own fallback, which goes to the parent.

On the server Vue's capture runs too. A render error there is reported through the server's Flare and stops at the boundary, but nothing is rendered in its place: server rendering is a single pass, so the fallback never gets its turn. The client then renders the tree itself.

A captured error stops at the boundary. It does not reach `app.config.errorHandler`, so a provider SDK whose Vue integration installs that handler does not report it a second time. Errors outside any boundary still reach that handler, and whoever owns it reports them.

## Tests

The tests mount real Vue components with Vue Test Utils in jsdom, over Flare's mock adapter. They count live listeners to prove that unmounting and replacing the provider's Flare leave none behind, render on the server to prove that observing is inert there and what the boundary does, and hydrate server markup to prove there is no mismatch. Nothing here runs in a browser.

## License

[MIT](LICENSE)
