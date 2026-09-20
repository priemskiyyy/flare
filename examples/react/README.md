# Flare React example

A small Vite and React application that shows the parts of [Flare](../../README.md) that are hard to see from an API listing. It needs no provider account and no server: the HTTP adapter posts to an in-page fake backend.

```sh
pnpm install
pnpm build
pnpm --filter example-react dev
```

The packages are linked from the workspace, so build them first.

## What to try

- **Report a payment failure.** The latest-report panel shows each destination settling. The console settles at once with `sdk-call-returned`. The demo backend settles after 400 ms with `backend-acknowledged` and an event id. Its sanitized payload is visible in the panel: `cardToken` becomes `"[Redacted]"` because the key matches a default redaction rule. Expand **Receipt JSON** for the full receipt.
- **Sign in, then report.** The report carries the user and a `signedIn` breadcrumb. Sign in as someone else and report again: the first account's breadcrumb is gone.
- **Start an upload, then switch account before it fails.** The upload takes three seconds and reports through a scope, which remembers who was signed in when it started. The panel explains why the report was not sent, and the receipt reads `dropped` with `stale-scope`. Let it fail without switching, and it is reported normally. A pending upload disables its button and is cancelled when the component unmounts.
- **Break the widget.** The error boundary reports the render error with React's component stack as the `react` context, and its fallback resets the widget.
- **Open the devtools.** The Flare button opens both destinations with what they declared, and the timeline follows each report from `report accepted` to its `destination outcome`. It never shows report content. The example's separate payload inspector shows only what the demo backend actually received.

On narrow screens, **View latest report** jumps to the receipt below the scenarios. **Clear view** hides the current receipt without changing the account or resetting the runtime.

## Where to look

| File                                         | What it shows                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/main.tsx`                               | One application runtime started outside React, the provider, devtools, and cleanup on hot reload. |
| `src/reporting/createExampleFlare.ts`        | Destination configuration, Zod schemas, and the `Register` declaration.                           |
| `src/backend/createExampleBackend.ts`        | An abortable in-page `fetch` and an observable copy of its latest sanitized request.              |
| `src/Application.tsx`                        | The page layout and the selected receipt.                                                         |
| `src/components/Header/Header.tsx`           | Account controls and `useDestinationStatus`.                                                      |
| `src/components/Scenarios/`                  | Separate capture, scope, and error-boundary examples.                                             |
| `src/components/ReportPanel/ReceiptView.tsx` | Observable receipt and request inspection with `useSyncExternalStore`.                            |
| `src/Application.test.tsx`                   | The flows driven through the buttons, with a fresh backend and runtime per test.                  |

Styles live beside their components; `src/styles.css` holds the shared palette, base elements, and page layout. There is no UI framework or extra runtime dependency.

The tests run with the workspace under `pnpm test:unit`. Build this application separately with `pnpm --filter example-react build`; the root `pnpm build` builds the library packages. To use a real backend, remove the injected `fetch` from the HTTP adapter configuration and point `endpoint` at your server.
