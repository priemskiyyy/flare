/**
 * Where one destination stands. `ready` means locally usable, not that a
 * network or a backend is reachable. `failed` holds what the adapter's `open`
 * threw; reports wait in the startup buffer, and `flare.start()` tries again.
 */
export type DestinationStatus =
  | { readonly state: "idle" }
  | { readonly state: "ready" }
  | { readonly state: "failed"; readonly error: unknown }
  | { readonly state: "disposed" };
