import type { ReporterAvailability } from "src/types/ReporterAvailability";
import type { ReporterCapabilities } from "src/types/ReporterCapabilities";
import type { ReporterOpenContext } from "src/types/ReporterOpenContext";
import type { ReporterSession } from "src/types/ReporterSession";

/**
 * Cold description of a destination. Creating an adapter opens nothing;
 * `open` does. Build one with `createReporterAdapter`, which supplies the
 * lifecycle guarantees so the adapter holds only provider mapping.
 *
 * @example
 * ```ts
 * const flare = new Flare({ destinations: { console: consoleReporter() } });
 * ```
 */
export type ReporterAdapter<TNative = unknown> = {
  /** For diagnostics only. The core never branches on it. */
  name: string;
  capabilities: ReporterCapabilities;
  available: () => ReporterAvailability;
  /**
   * The process-wide SDK this adapter drives, when `capabilities.instance` is
   * `singleton`. It is known before anything opens, so two destinations over
   * the same SDK are rejected at construction instead of reporting twice.
   */
  singleton?: object;
  open: (
    context: ReporterOpenContext,
  ) => ReporterSession<TNative> | Promise<ReporterSession<TNative>>;
};
