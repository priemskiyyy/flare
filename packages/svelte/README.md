# @priemskiyyy/flare-svelte

Svelte bindings for [Flare](../core): a provider, status utilities and an error boundary. They are deliberately thin. Reports are made with `flare.capture`, which needs no utility, and the bindings never start, stop or dispose anything.

Works in Svelte 5.7 or newer. The package ships Svelte sources, so it is compiled by your application's own Svelte.

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-svelte
```

## Set it up

Create and start the Flare outside Svelte, as early as your application allows, then publish it:

```ts
import { Flare } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";

export const flare = new Flare({
  destinations: { console: console() },
});

flare.start();
```

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

## Type it once

Register your Flare, and every utility and the boundary know its destination names and its schema:

<!-- snippet: fragment -->

```ts
declare module "@priemskiyyy/flare-svelte" {
  interface Register {
    flare: typeof flare;
  }
}
```

Without it everything still works, with destination names typed as `string`.

## Utilities

Call them while a component is being created, like any Svelte context reader:

```ts
import {
  useDestinationStatus,
  useFlare,
  useFlareStatus,
} from "@priemskiyyy/flare-svelte";

const flare = useFlare(); // { current } of the provider's Flare
const status = useFlareStatus(); // status.current.state
const sentry = useDestinationStatus("sentry");

const handleSaveClick = () => save().catch(flare.current.capture);
```

- `useFlare()` follows the provider, and throws `Flare utilities must be used within a FlareProvider.` when there is none.
- `useDestinationStatus(name)` accepts a string or a getter, and follows a name that changes. `ready` means locally usable, not that a network is reachable.
- Both status utilities accept an optional callback that is told about later changes.
- They observe only. Using them starts nothing, opens no destination and creates no report.
- On the server and until the component is mounted they read `idle`, so server markup and the hydrating render always match, even when the client started Flare first.

## FlareErrorBoundary

| Part               | Meaning                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------- |
| children           | The tree to guard.                                                                        |
| `fallback` snippet | Rendered instead, with `{ error, reset }`. `reset` renders the children again.            |
| `capture` prop     | Options for the report: `tags`, `contexts`, `level`, `operation`, `to`, `user`, `dedupe`. |
| `onError` prop     | Told after the report is made, with the `error` and the report's `receipt`.               |

It wraps `svelte:boundary` and reports each error that boundary catches, once. A second error after a `reset` is a new report. Svelte has no component stack, so the report carries only what `capture` gives it. Every prop also accepts `undefined`, so a parent can forward its own optional props.

Like every Svelte boundary it sees errors thrown while rendering and inside effects. It does not see errors in event handlers or in asynchronous code. Report those with `flare.current.capture`.

On the server a boundary catches nothing. The error leaves `render()` when the markup is read, and nothing is reported. Catch it there and report it yourself.

## Tests

The tests render real Svelte components with Svelte Testing Library in jsdom, over Flare's mock adapter. They count live listeners to prove that unmounting and replacing the provider's Flare leave none behind, and render on the server to prove that the utilities are inert there and that a boundary catches nothing. Hydration itself is not exercised: the first client value and the server value are each pinned to `idle` by a test of their own. Nothing here runs in a browser.

## License

[MIT](LICENSE)
