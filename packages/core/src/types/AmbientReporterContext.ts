import type { AmbientSnapshot } from "src/types/AmbientSnapshot";
import type { Breadcrumb } from "src/types/Breadcrumb";

/**
 * Optional mirroring of Flare state into a provider's global context, so that
 * reports the provider captures on its own, such as native crashes, carry it.
 * Isolation here is weaker than in `submit`: globals are shared, and some
 * providers cannot clear a value once set. `submit` must never use this path.
 * Callback failures, including rejected promises, are recorded in diagnostics.
 */
export type AmbientReporterContext = {
  session?: (snapshot: AmbientSnapshot) => void;
  breadcrumb?: (breadcrumb: Breadcrumb) => void;
};
