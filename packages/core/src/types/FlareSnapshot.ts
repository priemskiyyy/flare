import type { DestinationStatus } from "src/types/DestinationStatus";
import type { FlareStatus } from "src/types/FlareStatus";
import type { ReporterCapabilities } from "src/types/ReporterCapabilities";

/**
 * Frozen counts and statuses from Flare diagnostics. A snapshot never holds
 * report content.
 *
 * @example
 * ```ts
 * const snapshot = flare.diagnostics.get();
 * console.log(snapshot.pendingReceipts);
 * ```
 */
export type FlareSnapshot = {
  readonly status: FlareStatus;
  readonly generation: number;
  readonly breadcrumbs: number;
  readonly pendingReceipts: number;
  readonly destinations: ReadonlyArray<{
    readonly name: string;
    /** The adapter's diagnostic name, such as `sentry`. */
    readonly adapter: string;
    readonly status: DestinationStatus;
    readonly capabilities: ReporterCapabilities;
    readonly buffered: number;
    readonly inFlight: number;
  }>;
};
