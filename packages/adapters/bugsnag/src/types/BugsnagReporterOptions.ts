import type { BugsnagBreadcrumbConstructorLike } from "src/types/BugsnagBreadcrumbConstructorLike";
import type { BugsnagLike } from "src/types/BugsnagLike";

type Ownership =
  | {
      /**
       * The application starts and owns the SDK, and Flare never starts it.
       * This is the default, and the right choice when Bugsnag is also set up
       * for native crashes, sessions or source maps.
       */
      ownership?: "borrowed";
      start?: never;
    }
  | {
      /** Flare starts the SDK when the destination opens. Bugsnag has no way to be stopped. */
      ownership: "owned";
      /** Starts the SDK, for example `() => Bugsnag.start({ apiKey })`. */
      start: () => void;
    };

/**
 * Options for `bugsnag()`.
 *
 * @example
 * ```ts
 * bugsnag({ sdk: Bugsnag, Breadcrumb, messages: "as-error" });
 * ```
 */
export type BugsnagReporterOptions<TSdk extends BugsnagLike> = Ownership & {
  /** The static Bugsnag API: the default export of the SDK the application uses. */
  sdk: TSdk;
  /**
   * Bugsnag's `Breadcrumb` class. With it, a report's breadcrumbs are written
   * to its own event. Without it they cannot be, which the capabilities
   * declare and every affected report records as a loss.
   */
  Breadcrumb?: BugsnagBreadcrumbConstructorLike;
  /**
   * Bugsnag has no message events. `"skip"`, the default, leaves message
   * reports out. `"as-error"` sends each one as an error named `Message`,
   * and records that lossy mapping on the receipt.
   */
  messages?: "skip" | "as-error";
  /**
   * Mirrors parts of Flare's session into the Bugsnag client, so events
   * Bugsnag captures on its own, such as native crashes, carry them. Every
   * part is off by default. Isolation is weaker here, and Bugsnag cannot
   * clear breadcrumbs once they are left.
   */
  ambient?: {
    user?: boolean;
    tags?: boolean;
    contexts?: boolean;
    breadcrumbs?: boolean;
  };
};
