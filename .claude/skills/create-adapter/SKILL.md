---
name: create-adapter
description: Use when adding a new error reporting provider adapter to the Flare workspace, or reviewing one. Covers the package layout, the structural SDK type and its contract file, the fake, the required tests and the release wiring.
---

# Create a Flare adapter

Read `docs/writing-an-adapter.md` and `AGENTS.md` first. They define the contract and the house style. This file is the checklist for doing it inside this workspace.

## Before writing code

1. Install the provider SDK as an exact-pinned root devDependency. It is never a dependency of the adapter.
2. Read the SDK's declarations and the source of every call you plan to make. Write down, from the source and not from its documentation:
   - Can it attach a user, tags, contexts and breadcrumbs to one event without touching global state? Through what: a forked scope, a per-event callback, an event object?
   - What does its capture call return, and when? Before or after anything is sent?
   - Does it have a flush? What does a completed flush reach?
   - Does it queue? In memory or on disk?
   - How does the application know it was initialized, so `open` can refuse an SDK that would silently drop reports?
   - Can its own hooks discard an event, and can you tell when they did?
   - How does it merge one event's own data with its global state, and which side wins? Which names does it give meaning to?
   - Does it attribute every event to a user it holds globally? Can you read that user?
   - Does it accept any object, or only ones whose constructor is `Object`? The core's sanitized objects are ordinary, frozen ones.
3. Every answer becomes a loss, a skip reason, the evidence a result names, or a line in the README. If the SDK cannot do something, the adapter does not imitate it.

## Layout

Copy the closest existing adapter under `packages/adapters/`. Sentry is the model for a forked scope, Bugsnag for a per-event callback, Crashlytics for an SDK with nothing per event, HTTP for an instance with backend evidence. PostHog is the model for event properties merged over a global person, Datadog for attributes that its global context would overwrite, gathered under one name, Datadog Logs for a log whose own context wins, and OpenTelemetry for a record that carries everything itself.

```text
packages/adapters/<name>/
  package.json          peer on @priemskiyyy/flare, optional peer on the SDK
  tsdown.config.ts
  tsconfig.json
  README.md
  src/
    index.ts            the only barrel
    <name>.ts           the factory, its one export, and the helpers only it calls
    <name>.contracts.ts typecheck only: assigns the real SDK to <Name>Like
    <name>.test.ts
    conformance.test.ts
    fake<Name>.fixture.ts
    types/<Name>Like.ts the structural part of the SDK you call
    types/<Name>AdapterOptions.ts
    utils/constants/    the provider's names and limits
    utils/              what several files share, and an event mapping or
                        ambient mirror with a contract of its own
```

Name a helper for what it returns, such as `getReportLosses` or `getExceptionProperties`, and inline a one-line helper with one caller. A comment says what the code cannot: a provider quirk or a reason.

## Rules that are easy to break

- The factory is cold. Nothing happens until `open`.
- The adapter is a plain `{ name, open }`. The runtime owns the lifecycle: one `open`, one `dispose`, nothing called afterwards. Add no guards for it.
- Take the SDK the application set up. Never initialize or close it, and add no option that would.
- One package per SDK API, with one entry point and one factory. When the browser and React Native SDKs share an API, as Sentry's and Bugsnag's do, one package serves both. When they differ, as Datadog's and PostHog's do, the React Native SDK gets its own `<name>-react-native` package whose factory has the same name, and the small shared mapping is copied, with tests on each side.
- No `import` of the provider SDK outside `*.contracts.ts`, `*.fixture.ts` and tests. `pnpm test:package` fails the build if the bundle imports one.
- Never set global SDK state to carry one report. Never set and unset around a call.
- If the adapter has an ambient mirror, clear from each event whatever the mirror wrote, before writing the report. A report that waited in the buffer across a sign-in must not pick up the new account's data.
- The ambient option names are `user`, `tags`, `contexts` and `breadcrumbs`, all off by default, the same in every adapter.
- `evidence` on a result never claims more than the SDK's answer proves.
- If the SDK files every event under a user it holds globally, a report for anyone else is skipped as `identity-mismatch`. Compare the report's user with the SDK's; when the SDK hides its user, compare the report's identity generation with the current one, and list `identity.user` as a loss.
- Where the provider's global state wins a merge over the event's own data, gather the report's data under one name. Where the event wins, keep the report off every name the provider gives meaning to, and list each one kept off as a loss.
- Hand the SDK the core's data as it is: ordinary, frozen objects. An SDK that needs an `Error` gets `new SanitizedError(report.exception)`.
- The fake must respect the real SDK's limits and quirks, or the tests prove nothing. Mirror what you read in the source, including the inconvenient parts.

## Tests, written first

Write each test, watch it fail, then write the code.

- `conformance.test.ts` calls `testReporterAdapter` from `@priemskiyyy/flare/testing`. Its reports belong to `conformance-user`, so a fake whose provider attaches a user attaches that one.
- The factory is cold: creating the adapter calls nothing on the fake.
- Each field is mapped where the SDK wants it, and each unsupported field is a loss.
- Two concurrent reports for different accounts never share state.
- A message is carried or skipped as declared.
- `open` refuses an SDK that is not set up with a `FlareError` whose code is `NOT_INITIALIZED`, or `UNSUPPORTED` when it lacks a feature, and changes nothing before it does.
- Dispose removes what Flare wrote and nothing else, and leaves the SDK running.
- Ambient: only requested parts are mirrored, removal and sign-out are mirrored, a buffered report delivered after an account switch carries nothing of the new account, and everything is cleared on dispose.
- Assert with `toEqual` on specific fields. `toMatchObject({})` passes for anything.

Where the real SDK runs in Node or jsdom, add `<name>.sdk.test.ts` over the installed SDK, reading each event through its own before-send hook with the network stubbed. It proves what the fake assumes. When it cannot run there, say so in the README.

Then mutate the adapter on purpose, one change at a time, and confirm a test fails for each. A surviving mutation is a missing test, or dead code.

## Wiring

- The vitest project, the snippet map and the release checks find the package themselves. `scripts/verify-packages.mjs` refuses a bundle that imports any optional peer of the package.
- Import the package in the consumer's contracts and smoke test in `scripts/verify-packages.mjs`.
- Add a `## <package> <version> - Unreleased` entry to `CHANGELOG.md`.
- Add the adapter to `docs/adapters.md`, `docs/provider-limitations.md`, `docs/installation.md`, the root `README.md`, and the tables and lists in `docs/verification.md`, `docs/receipts.md`, `docs/flush.md`, `docs/native-access.md`, `docs/capture-and-message.md`, `docs/identity.md`, `docs/automatic-capture.md` and, for a React Native SDK, `docs/react-native.md`. Name the provider in the lists in `docs/index.md`, `docs/.vitepress/config.ts`, `README.md` and `packages/core/README.md`.
- Run `pnpm check:release`.

## Say what was not verified

The README ends with a Tests section that states what the tests ran against. If the adapter never ran against the provider's real backend or on a device, say so there and in `docs/verification.md`.
