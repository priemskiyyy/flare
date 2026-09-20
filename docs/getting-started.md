---
description: "Report your first error with Flare, add a user, send it to a real provider, and mount the React bindings."
---

# Getting started

## Report to the console

Install the core and the console destination:

```sh
pnpm add @priemskiyyy/flare @priemskiyyy/flare-console
```

Create one Flare for the application, start it, and report an error:

```ts
import { Flare } from "@priemskiyyy/flare";
import { consoleReporter } from "@priemskiyyy/flare-console";

export const flare = new Flare({
  destinations: { console: consoleReporter() },
});

flare.start();
flare.capture(new Error("Upload failed"));
// [flare] error Error: Upload failed
```

Creating a Flare is cheap and starts nothing, so it is safe at module scope and on a server. `start()` opens the destinations. A report captured before `start()` is kept briefly and delivered once its destination is ready.

## Say who and where

```ts
flare.user({ id: "user_42", email: "ada@example.com" });
flare.tag("plan", "pro");
flare.context("workspace", { id: "w_1", members: 12 });
flare.breadcrumb("uploadStarted", { kind: "avatar" });

flare.capture(new Error("Upload failed"), { tags: { area: "upload" } });
```

The user, the tag, the context and the breadcrumb describe the session, so every later report carries them. The `area` tag belongs to that one report only. See [tags, contexts, breadcrumbs](metadata.md) and [users and account switching](identity.md).

## Send it to a provider

Add a destination and choose where reports go by default. This example keeps the console for development and adds Sentry:

```ts
import { Flare } from "@priemskiyyy/flare";
import { consoleReporter } from "@priemskiyyy/flare-console";
import { sentry } from "@priemskiyyy/flare-sentry";
import * as Sentry from "@sentry/browser";

Sentry.init({ dsn });

export const flare = new Flare({
  destinations: {
    sentry: sentry({ sdk: Sentry }),
    console: consoleReporter(),
  },
  default: ["sentry"],
});

flare.start();
```

You pass the provider SDK in. Flare's adapters import no provider SDK themselves, so a browser bundle never pulls in a React Native SDK. See [choose an adapter](adapters.md).

## Know what happened

`capture()` is synchronous and never throws. Most code ignores what it returns. When you need to know, the receipt tells you:

```ts
const receipt = flare.capture(new Error("Upload failed"));
const status = await receipt.settled;

if (status.state === "settled" && status.outcomes.sentry?.status === "failed") {
  showOfflineBanner();
}
```

See [receipts and evidence](receipts.md).

## In React

```tsx
import { FlareErrorBoundary, FlareProvider } from "@priemskiyyy/flare-react";

export const Root = () => (
  <FlareProvider flare={flare}>
    <FlareErrorBoundary fallback={<p>Something went wrong.</p>}>
      <Application />
    </FlareErrorBoundary>
  </FlareProvider>
);
```

See [React](react.md) and [React Native and Expo](react-native.md). The same provider, status readers and boundary exist for [Vue](vue.md), [Solid](solid.md) and [Svelte](svelte.md).
