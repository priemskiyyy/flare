import type {
  DestinationName,
  Destinations,
  Flare,
  FlareSchema,
} from "@priemskiyyy/flare";

/**
 * Declaration-merging target that types every export of this package with the
 * application's Flare. Augment it once, next to the Flare:
 *
 * @example
 * ```ts
 * declare module "@priemskiyyy/flare-vue" {
 *   interface Register {
 *     flare: typeof flare;
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-empty-object-type -- declaration merging needs an interface.
export interface Register {}

/** The registered Flare's destinations, or untyped `Destinations` when nothing is registered. */
export type RegisteredDestinations = Register extends {
  flare: Flare<infer TDestinations extends Destinations, FlareSchema>;
}
  ? TDestinations
  : Destinations;

/** The registered Flare's schema, or the untyped schema when nothing is registered. */
export type RegisteredSchema = Register extends {
  flare: Flare<Destinations, infer TSchema extends FlareSchema>;
}
  ? TSchema
  : FlareSchema;

/** The registered Flare, or an untyped `Flare` when nothing is registered. */
export type RegisteredFlare = Flare<RegisteredDestinations, RegisteredSchema>;

/** The names the registered Flare's destinations were given. */
export type RegisteredDestinationName = DestinationName<RegisteredDestinations>;
