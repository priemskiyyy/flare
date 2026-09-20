/** A reactive value read through `current`, the way Svelte's own reactive classes expose one. */
export type ReadableValue<TValue> = { readonly current: TValue };
