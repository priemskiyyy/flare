import type { SentryLike } from "src/types/SentryLike";

type Ownership =
  | {
      /**
       * The application initializes and owns the SDK. Flare never initializes
       * it and never closes it. This is the default, and the right choice
       * when Sentry is also set up for native crashes, source maps or tracing.
       */
      ownership?: "borrowed";
      init?: never;
    }
  | {
      /** Flare initializes the SDK when the destination opens and closes it on disposal. */
      ownership: "owned";
      /** Initializes the SDK, for example `() => Sentry.init({ dsn })`. */
      init: () => void;
    };

/**
 * Options for `sentry()`.
 *
 * @example
 * ```ts
 * sentry({ sdk: Sentry, ambient: { user: true } });
 * ```
 */
export type SentryReporterOptions<TSdk extends SentryLike> = Ownership & {
  /** The Sentry SDK the application uses, passed as its module namespace. */
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
