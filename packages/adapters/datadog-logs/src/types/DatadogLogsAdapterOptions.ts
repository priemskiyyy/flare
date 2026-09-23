import type { DatadogLogsLike } from "src/types/DatadogLogsLike";

/**
 * Options for `datadogLogs()`. There is no ambient integration: the
 * application initializes the SDK and owns `setUser`, `clearUser` and its
 * global context.
 *
 * @example
 * ```ts
 * datadogLogs({ sdk: browserLogs });
 * ```
 */
export type DatadogLogsAdapterOptions<TSdk extends DatadogLogsLike> = {
  /** `datadogLogs` from `@datadog/browser-logs`, which the application initialized. */
  sdk: TSdk;
};
