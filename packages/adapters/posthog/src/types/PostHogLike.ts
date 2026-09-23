/**
 * The part of the posthog-js instance the adapter calls. The default export of
 * `posthog-js` satisfies it, so the package does not import it: the
 * application passes in the instance it initialized.
 *
 * @example
 * ```ts
 * import posthogJs from "posthog-js";
 *
 * posthogJs.init(token);
 * posthog({ sdk: posthogJs });
 * ```
 */
export type PostHogLike = {
  /** Set by `posthog.init`. Before it, every capture is silently ignored. */
  __loaded: boolean;
  /** Missing from a slim bundle initialized without error tracking. */
  exceptions?: unknown;
  /** The person PostHog attributes every event to, as `identify` and `reset` left it. */
  get_distinct_id: () => string;
  /**
   * Merges the properties over the exception's own and over PostHog's super
   * properties, on this event only. Answers `undefined` when PostHog's own
   * filters drop the event: opt-out, bots, rate limits, suppression rules and
   * `before_send`.
   */
  captureException: (
    error: unknown,
    additionalProperties?: Record<string, unknown>,
  ) => { uuid: string } | undefined;
};
