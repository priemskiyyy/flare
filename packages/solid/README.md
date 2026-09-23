# @priemskiyyy/flare-solid

Solid bindings for [Flare](../core): a provider, status primitives and an error boundary. They are deliberately thin. Reports are made with `flare.capture`, which needs no primitive, and the bindings never start, stop or dispose anything.

Works in Solid 1.9 or newer.

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-solid
```

## Set it up

Create and start the Flare outside Solid, as early as your application allows, then publish it:

```ts
import { Flare } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";

export const flare = new Flare({
  destinations: { console: console() },
});

flare.start();
```

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

## Type it once

Register your Flare, and every primitive and the boundary know its destination names and its schema:

<!-- snippet: fragment -->

```ts
declare module "@priemskiyyy/flare-solid" {
  interface Register {
    flare: typeof flare;
  }
}
```

Without it everything still works, with destination names typed as `string`.

## Primitives

```ts
import {
  useDestinationStatus,
  useFlare,
  useFlareStatus,
} from "@priemskiyyy/flare-solid";

const flare = useFlare(); // Accessor of the provider's Flare
const status = useFlareStatus(); // () => { state: "idle" | "started" | "disposed" }
const sentry = useDestinationStatus("sentry");

const handleSaveClick = () => save().catch(flare().capture);
```

- `useFlare()` follows the provider, and throws `Flare primitives must be used within a FlareProvider.` when there is none.
- `useDestinationStatus(name)` accepts a string or an accessor, and follows a name that changes. `ready` means locally usable, not that a network is reachable.
- Both status primitives accept an optional callback that is told about later changes.
- They observe only. Using them starts nothing, opens no destination and creates no report.
- On the server and until the component is mounted they read `idle`. Solid claims server markup as it is while hydrating, so a different first value would stay on screen until the next change.

## FlareErrorBoundary

| Prop       | Meaning                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------- |
| `fallback` | Required. What to render instead of the children, or a function that receives `{ error, reset }`. |
| `capture`  | Options for the report: `tags`, `contexts`, `level`, `operation`, `to`, `user`, `dedupe`.         |
| `onError`  | Told after the report is made, with the `error` and the report's `receipt`.                       |

It wraps Solid's own `ErrorBoundary` and reports each error that boundary catches, once. A second error after a `reset` is a new report. Solid has no component stack, so the report carries only what `capture` gives it.

Like every Solid boundary it sees errors thrown while rendering and inside reactive computations. It does not see errors in event handlers, or in asynchronous code outside a computation. Report those with `flare().capture`.

With server rendering, Solid's boundary also catches on the server. The error is then reported through the server's Flare and the fallback is rendered. Solid replays that error while the client hydrates, so the client's boundary reports it again through the client's Flare. Solid also serializes the error, with its stack, into the page to do so. That is Solid's behavior, and worth knowing before rendering a guarded tree on a server.

## Tests

The tests render real Solid components with Solid Testing Library in jsdom, over Flare's mock adapter. They count live listeners to prove that unmounting and replacing the provider's Flare leave none behind, and render on the server to prove that the primitives are inert there and what the boundary does. Hydration itself is not exercised: the first client value and the server value are each pinned to `idle` by a test of their own. Nothing here runs in a browser.

## License

[MIT](LICENSE)
