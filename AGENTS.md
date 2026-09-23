# Agent guide

Flare is a provider-independent error reporting runtime with provider adapters.
Its siblings are Silo, Simulcast and Switchboard, and it follows their
conventions. Before changing code, read `CONTRIBUTING.md` for layout and style,
`docs/internals/architecture.md` for the invariants, and the tests beside the
file you touch. `tasks/design.md` is a local decision log that is not
committed. When it is present, read it too, and amend it rather than drift
from a decision it records.

- The model: one `Flare` per application over named `destinations`. The core
  owns normalization, redaction, composition, routing, fan-out, receipts,
  buffering and deduplication. An adapter maps one sanitized report onto one
  provider and nothing more. The core never branches on an adapter name.
- An adapter never receives the raw thrown value, only the sanitized report.
  Provider SDKs are injected by the application and typed structurally, so an
  adapter package imports no provider SDK.
- Flare never throws into the host application at runtime. Only
  misconfiguration throws, as a `FlareError` with `INVALID_CONFIGURATION`: the
  constructor, `destination()` with an unknown name, a binding hook outside
  its provider, and mounting the devtools twice.
- Style: grouped options, `typeof x === "function"` guards, `type` over
  `interface`, no `enum`, no `switch`, no `any`, no `as` casts or `as const`,
  no non-null `!`, no `void` operator, no `&&` as control flow, no `??=`, `||=`
  or `&&=`, braces on every `if`, no `else` after a `return`,
  `assertUnreachable` at union dispatch, early returns, a blank line around
  declarations, blocks and returns, handlers named `handle*`, arrow functions
  exported one per file, `src/...` imports, re-exports only at package entry
  points, JSDoc with an example on public exports. Helpers are named for what
  they return, like `getReportLosses`, and a one-line helper with one caller
  is inlined. Comments only say what the code cannot: a provider quirk or a
  reason. No em dashes in code, comments or prose.
- Style carve-outs, each with a comment saying why, and nothing wider than
  these: one `as NativeOf<TDestinations>[TName]` in `Flare.destination`, where
  enumerating the destinations erases which native handle belongs to which
  name; the `Register` interface each binding declares, and the example
  augments, because declaration merging needs an interface; and relative
  imports in the Svelte binding, which `svelte-package` does not rewrite. The
  first two carry the only ESLint disables in the repository.
- A new test is watched failing before it is trusted. When the implementation
  came first, break it on purpose and confirm the test goes red.
- Verify with `pnpm check`. Do not commit, push or publish unless asked, and
  never add an agent attribution trailer or footer anywhere.
