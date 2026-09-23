/**
 * The part of a posthog-react-native client the adapter calls. A `PostHog`
 * instance satisfies it, so the package does not import the SDK: the
 * application passes in the client it created.
 *
 * @example
 * ```ts
 * import PostHog from "posthog-react-native";
 *
 * posthog({ sdk: new PostHog(apiKey) });
 * ```
 */
export type PostHogLike = {
  /** Settles once the client has loaded its storage, and with it the persisted distinct id. */
  ready: () => Promise<void>;
  /** The person PostHog attributes every event to. Empty until the client is ready. */
  getDistinctId: () => string;
  /**
   * Queues the event and answers nothing: a disabled or opted-out client and
   * `before_send` drop it without saying so.
   *
   * A method, so that PostHog's JSON-typed parameter accepts the report's
   * data, which is plain JSON by construction but typed `unknown`.
   */
  captureException(
    error: unknown,
    additionalProperties?: Record<string, unknown>,
  ): void;
  /** Sends the queue, and settles once PostHog has answered for it. */
  flush: () => Promise<void>;
};
