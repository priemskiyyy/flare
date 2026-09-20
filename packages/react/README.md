# @priemskiyyy/flare-react

React bindings for [Flare](../core): a provider, two status hooks and an error boundary. They are deliberately thin. Reports are made with `flare.capture`, which needs no hook, and the bindings never start, stop or dispose anything.

Works in React 19.2 or newer, in the browser and in React Native.

## Installation

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-react
```

## Set it up

Create and start the Flare outside React, as early as your application allows, then publish it:

```tsx
import { Flare } from "@priemskiyyy/flare";
import { consoleReporter } from "@priemskiyyy/flare-console";
import { FlareErrorBoundary, FlareProvider } from "@priemskiyyy/flare-react";

export const flare = new Flare({
  destinations: { console: consoleReporter() },
});

flare.start();

export const Root = () => (
  <FlareProvider flare={flare}>
    <FlareErrorBoundary fallback={<p>Something went wrong.</p>}>
      <Application />
    </FlareErrorBoundary>
  </FlareProvider>
);
```

## Type it once

Register your Flare, and every hook and the boundary know its destination names and its schema:

```ts
declare module "@priemskiyyy/flare-react" {
  interface Register {
    flare: typeof flare;
  }
}
```

Without it everything still works, with destination names typed as `string`.

## FlareProvider

<!-- snippet: fragment -->

```tsx
<FlareProvider flare={flare}>{children}</FlareProvider>
```

Publishes one Flare to the tree below, and does nothing else. The Flare owns its own lifetime. Mounting the provider starts no destination, and unmounting it shuts none down, so a remount, React Strict Mode or a fast refresh can never close the Sentry or Bugsnag SDK your application started.

## useFlare

```ts
import { useFlare } from "@priemskiyyy/flare-react";

const flare = useFlare();

const handleSavePress = () => save().catch(flare.capture);
```

Returns the nearest provider's Flare, and throws `Flare hooks must be used within a FlareProvider.` when there is none. `capture`, `message` and the other methods stay bound, so they can be passed around.

## useFlareStatus

```ts
import { useFlareStatus } from "@priemskiyyy/flare-react";

const status = useFlareStatus(); // { state: "idle" | "started" | "disposed" }
```

## useDestinationStatus

```ts
import { useDestinationStatus } from "@priemskiyyy/flare-react";

const sentry = useDestinationStatus("sentry");

if (sentry.state === "failed")
  console.warn("Sentry did not start", sentry.error);
```

One destination's status: `idle`, `starting`, `ready`, `unavailable`, `failed` or `disposed`. `ready` means locally usable, not that a network is reachable.

Both status hooks observe only. Rendering them starts nothing, opens no destination and creates no report. Both accept an optional callback that is told about later changes; it always sees the latest callback, and it gets a listener of its own so a callback that throws cannot disturb what React renders. On the server and during the hydrating render both read `idle`, so server and client markup match even when the client has already started Flare.

## FlareErrorBoundary

```tsx
import { FlareErrorBoundary } from "@priemskiyyy/flare-react";

<FlareErrorBoundary
  fallback={({ error, reset }) => (
    <RetryScreen error={error} onRetryPress={reset} />
  )}
  capture={{ tags: { area: "cart" }, level: "fatal" }}
>
  <Cart />
</FlareErrorBoundary>;
```

| Prop       | Meaning                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| `fallback` | Required. What to render instead of the children, or a function that also receives the `error` and a `reset`. |
| `capture`  | Options for the report: `tags`, `contexts`, `level`, `operation`, `to`, `user`, `dedupe`.                     |
| `onError`  | Told after the report is made, with the `error` and the report's `receipt`.                                   |

It reports the error once, Strict Mode included, and adds React's component stack as the `react` context, beside any contexts you pass. With a typed schema, declare that context or it is dropped and recorded on the report as a loss:

```ts
import { z } from "zod";

const schema = {
  contexts: { react: z.object({ componentStack: z.string() }) },
};
```

What a boundary does not catch is React's rule, not Flare's. A boundary sees errors thrown while rendering, in lifecycle methods and in constructors of the tree below it. It does not see errors in event handlers, in asynchronous code such as promises and timers, during server rendering, or in the boundary itself. Report those with `flare.capture`:

```ts
const handleSubmitPress = async () => {
  try {
    await submit();
  } catch (error) {
    flare.capture(error, { operation: "submit-order" });
  }
};
```

Two more things worth knowing:

- React 19 does not rethrow an error a boundary caught. It logs it through `console.error`. A provider SDK that turns console errors into events, such as Sentry's capture console integration, will therefore report it a second time. Turn that integration off, or see each adapter's README for giving one source one owner.
- In React Native the development LogBox covers a working fallback, so check a boundary's fallback in a release build.

## Tests

The tests render real React with Testing Library in jsdom, over Flare's mock adapter. They count live listeners to prove that Strict Mode and a remount leave none behind, and they render on the server and hydrate to prove that doing so is inert and mismatch free. Nothing here runs in a browser or on a device.

## License

[MIT](LICENSE)
