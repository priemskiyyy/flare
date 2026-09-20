import type { DestinationStatus } from "src/types/DestinationStatus";
import type { ObservableValue } from "src/types/ObservableValue";
import type { ReporterCapabilities } from "src/types/ReporterCapabilities";

/**
 * The escape hatch to one destination. Reading it is passive: it starts
 * nothing and creates no report. Calls made on `native` bypass Flare's
 * routing, receipts, normalization and privacy guarantees.
 *
 * @example
 * ```ts
 * const sentry = flare.destination("sentry");
 * sentry.status.get();
 * sentry.native?.addBreadcrumb({ message: "outside Flare" });
 * ```
 */
export type DestinationHandle<TNative = unknown> = {
  readonly capabilities: ReporterCapabilities;
  readonly status: ObservableValue<DestinationStatus>;
  /** The provider handle, or `null` until the destination is ready. */
  readonly native: TNative | null;
};
