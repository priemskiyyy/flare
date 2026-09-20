import type { Destinations } from "src/types/Destinations";

/** The names an application registered its destinations under. */
export type DestinationName<TDestinations extends Destinations> =
  keyof TDestinations & string;
