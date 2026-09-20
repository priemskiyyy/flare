import type { SentryEventLike } from "src/types/SentryEventLike";

/**
 * The scope used by {@link SentryLike.withScope} to map one report.
 * Sentry's browser and React Native scopes both satisfy it.
 *
 * @example
 * ```ts
 * sdk.withScope((scope) => scope.addEventProcessor((event) => event));
 * ```
 */
export type SentryScopeLike = {
  /** Maps a composed event without changing any shared scope. */
  addEventProcessor: (
    processor: (event: SentryEventLike) => SentryEventLike,
  ) => unknown;
};
