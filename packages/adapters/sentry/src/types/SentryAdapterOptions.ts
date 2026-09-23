import type { SentryLike } from "src/types/SentryLike";

/**
 * Options for `sentry()`.
 *
 * @example
 * ```ts
 * sentry({ sdk: Sentry, ambient: { user: true } });
 * ```
 */
export type SentryAdapterOptions<TSdk extends SentryLike> = {
  /** The Sentry SDK the application initialized, passed as its module namespace. */
  sdk: TSdk;
  /**
   * Mirrors parts of Flare's session into Sentry's global scope, so events
   * Sentry captures on its own, such as native crashes, carry them. Every part
   * is off by default. Isolation is weaker here than for reports Flare
   * submits: the global scope is shared by everything Sentry sends.
   */
  ambient?: {
    user?: boolean;
    tags?: boolean;
    contexts?: boolean;
    breadcrumbs?: boolean;
  };
};
