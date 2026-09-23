---
description: "Mount the Flare devtools to see each destination's status and queues, and follow a report from capture to its outcome, without exposing report content."
---

# Devtools

The devtools are an in-page inspector. They show where each destination stands, how many reports are buffered or in flight, and a timeline of what happened to every report.

```sh
pnpm add -D @priemskiyyy/flare-devtools
```

In React, inside your `FlareProvider`:

```tsx
import { FlareDevtools } from "@priemskiyyy/flare-devtools/react";
import { FlareProvider } from "@priemskiyyy/flare-react";

export const Root = () => (
  <FlareProvider flare={flare}>
    <Application />
    {import.meta.env.DEV ? <FlareDevtools /> : null}
  </FlareProvider>
);
```

Vue and Solid have a component of their own, under `./vue` and `./solid`. Svelte has an attachment under `./svelte`, `createDevtools()`, used as `<div {@attach devtools}>`, which needs Svelte 5.29. Each reads the Flare from its provider, and on the server renders at most an empty host element. The inspector itself is framework independent: it carries its own small UI runtime inside its bundle, so your application needs nothing installed for it.

Anywhere else:

```ts
import { FlareDevtools } from "@priemskiyyy/flare-devtools";

const devtools = new FlareDevtools({ flare });

devtools.mount(document.body.appendChild(document.createElement("div")));
```

Keep it out of production with a condition your bundler can remove, as above.

## What you get

A launcher whose dot turns red when something failed while the panel was closed. A panel that docks to the bottom or the right and resizes. Each destination with its status and its queues. A timeline you can search, filter by kind or by destination, pause and clear, where every row expands to its context. Anything that did not verifiably arrive is filed under errors.

## It only reads

The inspector reads `flare.diagnostics` and nothing else. It never starts Flare, opens a destination or creates a report. Diagnostics carry ids, reasons and counts, and never a report, a thrown value or a provider's error, so the panel has no report content to leak and nothing to redact.

## Without the panel

The same data is available to your own code, for example to log it in a test or a bug report:

```ts
const unsubscribe = flare.diagnostics.events.subscribe((event) => {
  console.log(event.type, event.destination, event.report, event.context);
});

const snapshot = flare.diagnostics.get();

console.log(
  snapshot.status.state,
  snapshot.pendingReceipts,
  snapshot.destinations,
);
```

The [package README](https://github.com/priemskiyyy/flare/tree/main/packages/devtools#readme) covers the options, what each column means and the accessibility of the panel. To use the timeline to find a missing report, see [troubleshooting](troubleshooting.md).
