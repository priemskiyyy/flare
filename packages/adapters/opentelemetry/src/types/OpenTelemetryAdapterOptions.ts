import type { OpenTelemetryLoggerLike } from "src/types/OpenTelemetryLoggerLike";

/**
 * Options for `opentelemetry()`.
 *
 * @example
 * ```ts
 * opentelemetry({
 *   logger: provider.getLogger("app"),
 *   forceFlush: () => provider.forceFlush(),
 * });
 * ```
 */
export type OpenTelemetryAdapterOptions<
  TLogger extends OpenTelemetryLoggerLike,
> = {
  /** The logger the application's provider made. */
  logger: TLogger;
  /**
   * Exports what the provider's processors hold, such as the SDK's
   * `provider.forceFlush()`. Without it, `flare.flush()` reports this
   * destination as `unsupported`.
   */
  forceFlush?: () => PromiseLike<unknown>;
};
