import type { CrashlyticsLike } from "src/types/CrashlyticsLike";

/**
 * Options for `crashlytics()`. The native Firebase SDK initializes
 * Crashlytics, never JavaScript.
 *
 * @example
 * ```ts
 * crashlytics({ sdk: Crashlytics, ambient: { user: true, tags: true } });
 * ```
 */
export type CrashlyticsAdapterOptions<TInstance> = {
  /** The Crashlytics module, passed as its namespace. */
  sdk: CrashlyticsLike<TInstance>;
  /**
   * Mirrors parts of Flare's session into Crashlytics' global state, which is
   * the only way any of it reaches Crashlytics: `user` becomes the user id,
   * `tags` and `contexts` become custom keys, and `breadcrumbs` become log
   * lines. Every part is off by default. This state is global, so it
   * describes the current account and not any one report.
   */
  ambient?: {
    user?: boolean;
    tags?: boolean;
    contexts?: boolean;
    breadcrumbs?: boolean;
  };
};
