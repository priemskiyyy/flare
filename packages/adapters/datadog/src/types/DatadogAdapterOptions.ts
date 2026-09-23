import type { DatadogRumLike } from "src/types/DatadogRumLike";

/**
 * Options for `datadog()`. There is no ambient integration: the application
 * initializes RUM and owns `setUser`, `clearUser` and its global context.
 *
 * @example
 * ```ts
 * datadog({ sdk: datadogRum });
 * ```
 */
export type DatadogAdapterOptions<TSdk extends DatadogRumLike> = {
  /** `datadogRum`, which the application initialized. */
  sdk: TSdk;
};
