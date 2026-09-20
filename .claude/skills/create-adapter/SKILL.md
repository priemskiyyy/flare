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
   - Is it a process-wide singleton?
   - Can its own hooks discard an event, and can you tell when they did?
3. Every answer becomes a capability, a loss or a skip reason. If the SDK cannot do something, the adapter does not imitate it.

## Layout

Copy the closest existing adapter under `packages/adapters/`. Sentry is the model for a forked scope, Bugsnag for a per-event callback, Crashlytics for an SDK with nothing per event, HTTP for an instance with backend evidence.

```text
packages/adapters/<name>/
  package.json          peer on @priemskiyyy/flare, optional peer on the SDK
  tsdown.config.ts
  tsconfig.json
  README.md
  src/
    index.ts            the only barrel
    <name>.ts           the factory, one export
    <name>.contracts.ts typecheck only: assigns the real SDK to <Name>Like
    <name>.test.ts
    conformance.test.ts
    fake<Name>.fixture.ts
    types/<Name>Like.ts the structural part of the SDK you call
    types/<Name>ReporterOptions.ts
    utils/              one export per file, named after it
```

## Rules that are easy to break

- The factory is cold. Nothing happens until `open`.
- No `import` of the provider SDK outside `*.contracts.ts`, `*.fixture.ts` and tests. `pnpm test:package` fails the build if the bundle imports one.
- Never set global SDK state to carry one report. Never set and unset around a call.
- If the adapter has an ambient mirror, clear from each event whatever the mirror wrote, before writing the report. A report that waited in the buffer across a sign-in must not pick up the new account's data.
- The ambient option names are `user`, `tags`, `contexts` and `breadcrumbs`, all off by default, the same in every adapter.
- `evidence` on a result is never stronger than the declared capability.
- The fake must respect the real SDK's limits and quirks, or the tests prove nothing. Mirror what you read in the source, including the inconvenient parts.

## Tests, written first

Write each test, watch it fail, then write the code.

- `conformance.test.ts` calls `testReporterAdapter` from `@priemskiyyy/flare/testing`.
- The factory is cold: creating the adapter calls nothing on the fake.
- Each field is mapped where the SDK wants it, and each unsupported field is a loss.
- Two concurrent reports for different accounts never share state.
- A message is carried or skipped as declared.
- `open` rolls back what it set up when the SDK fails to start.
- Borrowed: dispose removes what Flare wrote and nothing else. Owned: the SDK is initialized on open and closed on dispose if it can be.
- Ambient: only requested parts are mirrored, removal and sign-out are mirrored, a buffered report delivered after an account switch carries nothing of the new account, and everything is cleared on dispose.
- Assert with `toEqual` on specific fields. `toMatchObject({})` passes for anything.

Then mutate the adapter on purpose, one change at a time, and confirm a test fails for each. A surviving mutation is a missing test.

## Wiring

- Add the project to `vitest.config.ts`.
- In `scripts/verify-packages.mjs`, add each bundle to the list that must not import its provider SDK, and import the package in the consumer's contracts and smoke test. Packing itself discovers the package.
- Add a `## <package> <version> - Unreleased` entry to `CHANGELOG.md`.
- Add the adapter to `docs/adapters.md`, `docs/provider-limitations.md`, `docs/installation.md` and the version table in `docs/verification.md`.
- Run `pnpm check:release`.

## Say what was not verified

The README ends with a Tests section that states what the tests ran against. If the adapter never ran against the provider's real backend or on a device, say so there and in `docs/verification.md`.
