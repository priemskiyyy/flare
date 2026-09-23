import type { DdRumLike } from "src/types/DdRumLike";

/**
 * Options for `datadog()`. There is no ambient integration: the application
 * initializes the SDK and owns `setUserInfo`, `clearUserInfo` and its
 * attributes.
 *
 * @example
 * ```ts
 * datadog({ sdk: DdRum });
 * ```
 */
export type DatadogAdapterOptions<TSdk extends DdRumLike> = {
  /** `DdRum` from `@datadog/mobile-react-native`. */
  sdk: TSdk;
};
