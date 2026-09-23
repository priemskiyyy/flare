import type { PostHogLike } from "src/types/PostHogLike";

/**
 * Options for `posthog()`. There is no ambient integration: the application
 * initializes PostHog and owns `identify` and `reset`.
 *
 * @example
 * ```ts
 * posthog({ sdk: posthogJs });
 * ```
 */
export type PostHogAdapterOptions<TSdk extends PostHogLike> = {
  /** The posthog-js instance the application initialized. */
  sdk: TSdk;
};
