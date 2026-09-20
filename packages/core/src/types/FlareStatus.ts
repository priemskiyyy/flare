/** Where the runtime stands. Whether a destination is usable is on its own status. */
export type FlareStatus =
  | { readonly state: "idle" }
  | { readonly state: "started" }
  | { readonly state: "disposed" };
