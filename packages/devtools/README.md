# @priemskiyyy/flare-devtools

An in-page inspector for [Flare](../core). It shows where each destination stands and what it can honestly do, how many reports are buffered or in flight, and a searchable timeline of what happened to every report.

It reads `flare.diagnostics` and nothing else. It never starts Flare, opens a destination or creates a report, and it shows no report content, because the diagnostics hold none.

The inspector is framework independent. It carries its own small UI runtime inside its bundle and renders in a shadow root, so your application needs nothing installed for it, and neither side's styles reach the other.

## Installation

```sh
pnpm add -D @priemskiyyy/flare-devtools
```

## Mount it

In React, inside your `FlareProvider`:

```tsx
import { FlareDevtools } from "@priemskiyyy/flare-devtools/react";
import { FlareProvider } from "@priemskiyyy/flare-react";

<FlareProvider flare={flare}>
  <Application />
  {import.meta.env.DEV ? <FlareDevtools /> : null}
</FlareProvider>;
```

The other bindings have a wrapper of their own, each reading the Flare from its provider:

| Binding | Import                               | Use                                                                                              |
| ------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| React   | `@priemskiyyy/flare-devtools/react`  | `<FlareDevtools />`                                                                              |
| Vue     | `@priemskiyyy/flare-devtools/vue`    | `<FlareDevtools v-if="isDevelopment" />`                                                         |
| Solid   | `@priemskiyyy/flare-devtools/solid`  | `<FlareDevtools />`                                                                              |
| Svelte  | `@priemskiyyy/flare-devtools/svelte` | `const devtools = createDevtools();` then `<div {@attach devtools}></div>`, Svelte 5.29 or newer |

Every wrapper renders only an empty host element on the server, or nothing, follows a provider that is given another Flare, and removes the inspector when it unmounts.

Anywhere else:

```ts
import { FlareDevtools } from "@priemskiyyy/flare-devtools";

const devtools = new FlareDevtools({ flare });
devtools.mount(document.body.appendChild(document.createElement("div")));
```

Keep it out of production builds with a condition your bundler can remove, as above. The inspector is a development tool, and nothing in Flare depends on it.

## Options

| Option          | Default | Meaning                                                                       |
| --------------- | ------- | ----------------------------------------------------------------------------- |
| `flare`         | -       | The Flare to inspect. A wrapper reads it from the provider instead.           |
| `initialIsOpen` | `false` | Opens the panel on the first visit. Later visits restore the last open state. |
| `maxEvents`     | `200`   | Events kept in memory, clamped to 1 to 1000.                                  |

The class also has `unmount()`, `setFlare(flare)` and `setMaxEvents(count)`. Mounting twice throws; unmounting twice does nothing. Recorded events survive an unmount, so the timeline is still there when the inspector is mounted again.

## What it shows

- **Launcher**: a small pill with a status dot. The dot turns red when something failed while the panel was closed, and clears once you have looked.
- **Header**: whether Flare is `idle`, `started` or `disposed`, then the identity generation, the number of session breadcrumbs and the receipts still pending. The panel docks to the bottom or to the right and resizes by dragging its edge or with the arrow keys. Its size, dock and open state are remembered.
- **Destinations**: each one with its adapter, its status, and what it has buffered and in flight. Select one to see what it declared, which is which fields are event-local, whether messages are carried, the strongest evidence, the flush boundary, the queue, automatic capture, whether it is a singleton, and whether provider hooks can still drop a report. Selecting one also narrows the timeline to it, and to the events that belong to no destination, since a dropped report is often why a destination saw nothing.
- **Timeline**: every diagnostic event, newest first, with its time, type, destination, a short report id and a one-line summary. A row expands to its full context, which can be copied. Search matches any of those. The kind chips narrow to errors, reports, destinations, session or runtime, each with a live count. Pause stops recording and Clear empties the timeline. Neither touches Flare.

Anything that did not verifiably arrive counts as an error: a dropped report, a reached rate limit, a refused session change, a destination that is unavailable or failed, and every outcome other than `submitted`.

Recording runs while the inspector is mounted, also when the panel is collapsed.

## Privacy

Diagnostic events carry ids, reasons, counts and the names of what was lost. They never carry a report, a thrown value or an error a provider failed with. A failed destination's error, which comes from a provider SDK and may quote configuration, is deliberately not shown either. As a second line of defence the inspector redacts any context key that looks like a secret, copies contexts without running getters, and writes every string it shows as text, never as markup.

## Accessibility

The launcher and every control are native buttons with a visible focus ring. The panel is a labelled complementary landmark, the destinations are a labelled navigation, the resize handle is a focusable separator, and kind chips and destinations state whether they are pressed. Opening moves focus into the panel and Escape closes it and returns focus to the launcher, while a panel restored from a previous visit never steals focus. Motion is removed for people who ask for less of it, and the panel follows the light or dark preference.

## Diagnose a missing report

1. Press the Errors chip. A `report dropped` row names its reason: `stale-scope`, `rate-limited`, `reentrant`, `sanitizer-failed`, `route-failed`, `no-destinations` or `disposed`.
2. If the report was accepted, expand `report accepted` and check that the destination you expected is in its `destinations`. If not, it is a routing question: `default`, `route` or the capture's `to`.
3. Select that destination and find its `destination outcome`. `skipped` and `dropped` name their reason. `indeterminate` with `deadline` means the provider took too long, which does not prove the report was lost.
4. If the outcome is `submitted`, Flare handed the report over. The destination's detail says what its evidence proves and whether provider hooks can still drop it. Then look in the provider's own tools.

## Tests

The tests render into a real shadow root in jsdom and query it by role, over Flare's mock adapter. They count live listeners to prove that unmounting leaves none behind, render each wrapper through its own binding, render on the server to prove the wrappers are inert there, and assert that a secret placed in a report appears nowhere in the panel. Nothing here runs in a browser, so layout, styling and real pointer dragging are not covered.

## License

[MIT](LICENSE)
