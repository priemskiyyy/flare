import type { PostHogLike } from "src/types/PostHogLike";

/**
 * Options for `posthog()`. There is no ambient integration: the application
 * creates the client and owns `identify` and `reset`.
 *
 * @example
 * ```ts
 * posthog({ sdk: client });
 * ```
 */
export type PostHogAdapterOptions<TSdk extends PostHogLike> = {
  /** The posthog-react-native client the application created. */
  sdk: TSdk;
};
