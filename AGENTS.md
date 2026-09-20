# Agent guide

Flare is a provider-independent error reporting runtime with reporter adapters.
Its siblings are Silo and Simulcast, and it follows their conventions. Before
changing code, read `CONTRIBUTING.md` for layout and style,
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
- Flare never throws into the host application at runtime. Only constructor
  misconfiguration throws.
- Style: grouped options, `typeof x === "function"` guards, `type` over
  `interface`, no `enum`, no `switch`, no `any`, no `as` casts, no `void`
  operator, no `&&` as control flow, no `??=`, `||=` or `&&=`, braces on every
  `if`, `assertUnreachable` at union dispatch, early returns, handlers named
  `handle*`, arrow functions exported one per file, `src/...` imports, JSDoc
  with an example on public exports, comments that say why. No em dashes in
  code, comments or prose.
- Style carve-outs, each with a comment saying why, and nothing wider than
  these: one `as NativeOf<TDestinations>[TName]` in `Flare.destination`, where
  enumerating the destinations erases which native handle belongs to which
  name. It carries the only ESLint disable in the repository.
- A new test is watched failing before it is trusted. When the implementation
  came first, break it on purpose and confirm the test goes red.
- Verify with `pnpm check`. Do not commit, push or publish unless asked, and
  never add an agent attribution trailer or footer anywhere.
