/**
 * Where one destination stands. `ready` means locally usable, not that a
 * network or a backend is reachable.
 */
export type DestinationStatus =
  | { readonly state: "idle" }
  | { readonly state: "starting" }
  | { readonly state: "ready" }
  | { readonly state: "unavailable"; readonly reason: string }
  | { readonly state: "failed"; readonly error: unknown }
  | { readonly state: "disposed" };
