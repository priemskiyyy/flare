import type { Destinations, Flare, FlareSchema } from "@priemskiyyy/flare";

/** All the inspector ever touches. Typing it this narrowly is what keeps the inspector passive. */
export type ObservedFlare = Pick<
  Flare<Destinations, FlareSchema>,
  "diagnostics"
>;
