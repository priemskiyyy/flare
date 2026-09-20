import type { Destinations } from "src/types/Destinations";
import type { ReporterAdapter } from "src/types/ReporterAdapter";

/** The provider handle type of each named destination. */
export type NativeOf<TDestinations extends Destinations> = {
  [TName in keyof TDestinations]: TDestinations[TName] extends ReporterAdapter<
    infer TNative
  >
    ? TNative
    : never;
};
