---
description: "Use Flare in React: publish it with a provider, report render errors with an error boundary, and read status with hooks that start nothing."
---

# React

`@priemskiyyy/flare-react` is a provider, an error boundary, `useFlare` and two status hooks. It is deliberately thin: reporting is `flare.capture`, and the bindings never start, stop or dispose anything.

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-react
```

## Set it up

Create and start the Flare outside React, then publish it:

```tsx
import { Flare } from "@priemskiyyy/flare";
import { console } from "@priemskiyyy/flare-console";
import { FlareErrorBoundary, FlareProvider } from "@priemskiyyy/flare-react";

export const flare = new Flare({
  destinations: { console: console() },
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

The provider owns no lifetime. Mounting it starts nothing and unmounting it disposes nothing, so Strict Mode, a remount or a fast refresh can never close the provider SDK your application started.

## Render errors

`FlareErrorBoundary` reports what React's error boundaries can see, once, with React's component stack attached as the `react` context, and renders its `fallback`. `onError` is told about each report, with the error and its receipt:

```tsx
import { FlareErrorBoundary } from "@priemskiyyy/flare-react";

export const CartSection = () => (
  <FlareErrorBoundary
    fallback={({ error, reset }) => (
      <RetryScreen error={error} onRetryPress={reset} />
    )}
    capture={{ tags: { area: "cart" }, level: "fatal" }}
    onError={({ receipt }) => console.debug("reported", receipt.id)}
  >
    <Cart />
  </FlareErrorBoundary>
);
```

With a typed schema, declare the `react` context, or it is dropped and recorded as a loss:

```ts
import { z } from "zod";

const schema = {
  contexts: { react: z.object({ componentStack: z.string() }) },
};
```

A boundary must sit inside a `FlareProvider`, and throws while rendering when it does not.

## Report from a component

A boundary does not see errors in event handlers, promises, timers or server rendering. That is React's rule. Report those through `useFlare()`, which returns the provider's Flare and throws a `FlareError` with the code `INVALID_CONFIGURATION` outside a provider:

```tsx
import { useFlare } from "@priemskiyyy/flare-react";

export const SubmitButton = () => {
  const flare = useFlare();

  const handleSubmitPress = async () => {
    try {
      await submit();
    } catch (error) {
      flare.capture(error, { operation: "submit-order" });
    }
  };

  return <button onClick={handleSubmitPress}>Submit</button>;
};
```

## Status

```tsx
import { useDestinationStatus, useFlareStatus } from "@priemskiyyy/flare-react";

export const ReportingStatus = () => {
  const flareStatus = useFlareStatus();
  const sentry = useDestinationStatus("sentry");

  return (
    <p>
      Flare is {flareStatus.state}, Sentry is {sentry.state}
    </p>
  );
};
```

Both hooks only observe. Rendering them starts nothing and reports nothing. On the server and during hydration they read `idle`, so server and client markup match.

## Type it once

Register your Flare, and the hooks and the boundary know your destination names and your schema:

<!-- snippet: fragment -->

```ts
declare module "@priemskiyyy/flare-react" {
  interface Register {
    flare: typeof flare;
  }
}
```

## One thing to check in your provider

React 19 does not rethrow an error that a boundary caught. It logs it through `console.error`. A provider integration that turns console errors into events, such as Sentry's capture console integration, will report the same error a second time. Turn that integration off.

The [package README](https://github.com/priemskiyyy/flare/tree/main/packages/react#readme) is the full reference for every prop and hook.
