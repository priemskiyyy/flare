# Contributing

Use Node 22.18 or newer and the pnpm version in `package.json`. Run `pnpm install --frozen-lockfile`, then `pnpm check` before submitting a change. `pnpm check:release` adds the documentation checks and the packed consumer, and is what a release must pass.

## Layout

- `packages/core`: the runtime, published as `@priemskiyyy/flare` with the `./mock` and `./testing` subpaths.
- `packages/adapters/*`: one package per provider SDK API, published as `@priemskiyyy/flare-<name>`. Sentry's and Bugsnag's React Native SDKs share their browser API, so one package serves both; Datadog's and PostHog's do not, so each has a `-react-native` package.
- `packages/react`, `packages/vue`, `packages/solid`, `packages/svelte`: the bindings. Each has the same surface, a provider, `useFlare`, `useFlareStatus`, `useDestinationStatus` and `FlareErrorBoundary`, in its framework's own idiom.
- `packages/devtools`: the in-page inspector, a Solid application that Vite bundles together with its runtime, and one thin wrapper per binding.
- `packages/trace`: the Trace breadcrumb bridge.
- `examples/react`: Ledger, a runnable application, tested through its buttons as the `example-react` vitest project, and in Chromium by `pnpm test:examples`, which is not part of `pnpm check`.
- `docs/`: the VitePress site. The sidebar in `docs/.vitepress/config.ts` is the one list of pages.
- `scripts/`: the release gates. Each has been probed with a deliberately broken input, so keep that habit when changing one.
- `docs/internals/architecture.md`: the owners, the path of a report, the principles, and the test that guards each invariant.

Runtime owners and helpers live in `utils/`, shared helpers in `utils/common/`, constants in `utils/constants/`, and shared contracts in `types/`, one type per file. The mock adapter lives in `mock/` and the conformance suite in `testing/`. Internal contracts belong in each folder's `internal/` directory, so `utils/internal/` holds the helpers no consumer may import. Package roots export the supported public API explicitly, one export per file, and no other file is a barrel. An adapter keeps its factory, and the helpers only the factory calls, in `src/<name>.ts`; `utils/` holds what several files share and the units with a contract of their own, such as an event mapping or an ambient mirror; `utils/constants/` holds the provider's names and limits.

Two packages differ by necessity. `packages/svelte` is built by `svelte-package`, which rewrites no aliases, so it imports by relative path with a `.js` extension instead of `src/`, and its fixtures are `*.fixture.svelte` components. `packages/devtools` writes its UI as Solid JSX under `src/components`, with hooks under `src/hooks`.

## Code

Prefer descriptive names, early returns, `type` over `interface`, and exhaustive dispatch closed by `assertUnreachable`. Name a helper for what it returns, such as `getReportLosses`, and inline a one-line helper with one caller. No `enum`, `switch`, `any`, `as` casts or `as const`, the `void` operator, `&&` as control flow, or the logical assignment operators; a guard clause says what happens when the value is already there. ESLint keeps a blank line around declarations, blocks and returns, as Switchboard does. Use `src/...` imports within each package. `Flare.dispose()` is synchronous, void and idempotent. Adapter sessions may return a promise from disposal; the runtime observes its failure without waiting. Avoid introducing a shared abstraction for a single use.

Flare is a best-effort feature of its host application. Every adapter call, sanitizer and user callback is contained, and a failure becomes a receipt outcome or a diagnostic, never a throw into the host.

## Adapters

An adapter maps one sanitized report onto one provider and nothing more. [Writing an adapter](docs/writing-an-adapter.md) is the contract, and the `create-adapter` skill in `.claude/skills` is the checklist for this workspace. The rules that are easiest to break:

- It is a plain `ReporterAdapter`, a name and an `open`. The runtime opens each destination once, disposes it once and calls nothing on it afterwards, so it needs no lifecycle guards of its own.
- The factory is cold: nothing is read, opened or sent until `open`. `open` returns a session, or throws a `FlareError` with `NOT_INITIALIZED` or `UNSUPPORTED` before it changes anything.
- It takes the SDK the application set up, never initializes or closes it, never receives the thrown value, never mutates provider globals from `submit`, and never claims stronger evidence than its provider gives.
- If the provider builds each event from a copy of its global state, clear whatever the ambient integration wrote before writing the report's own: that state describes the current account, which may not be the report's.
- It runs the shared conformance suite from `@priemskiyyy/flare/testing` in `src/conformance.test.ts`, asserts its own coldness, and tests against an in-process fake in `src/fake<Sdk>.fixture.ts`. Adapter tests import the core by its package name, so run `pnpm build` first.

## Testing

`pnpm test:unit` runs one vitest project per package, each with a `src` alias onto its own source. Tests sit beside their sources as `<Source>.test.ts` and are named after the invariant they guard. A new test is watched failing once before it is trusted. Interleaving is tested by reentrancy and by held mock submissions, not by sleeping; fake timers are for deadlines, buffer age and dedupe windows.

## Documentation

Every `ts` and `tsx` example in a README, in `docs/` and in `examples/` is typechecked against the built packages by `pnpm verify:snippets`. Write examples that compile as they stand. A name that stands for the reader's application goes in `scripts/snippets.ambient.d.ts`. Mark a fence with `<!-- snippet: fragment -->` only when it cannot be a module, such as bare JSX, or when it augments a module with `declare module`: every snippet compiles in one program, so an augmentation would retype all the others.

A compiling example proves its types, not its claims. Check each statement about behavior against the source or a test, and say plainly what was not verified. `pnpm verify:docs` checks the built site: one heading per page, live links and anchors, descriptions, and that every page is in the sidebar.

No em dashes, no agent names and no generated-by footers anywhere in the repository, including commit messages and changelog entries.
