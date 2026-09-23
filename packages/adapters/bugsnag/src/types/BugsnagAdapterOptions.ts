import type { BugsnagBreadcrumbConstructorLike } from "src/types/BugsnagBreadcrumbConstructorLike";
import type { BugsnagLike } from "src/types/BugsnagLike";

/**
 * Options for `bugsnag()`.
 *
 * @example
 * ```ts
 * bugsnag({ sdk: Bugsnag, Breadcrumb, messages: "as-error" });
 * ```
 */
export type BugsnagAdapterOptions<TSdk extends BugsnagLike> = {
  /** The static Bugsnag API the application started: the default export of its SDK. */
  sdk: TSdk;
  /**
   * Bugsnag's `Breadcrumb` class, a named export of the same package. A
   * report's breadcrumbs are written to its own event as instances of it,
   * and the static API does not expose the class.
   */
  Breadcrumb: BugsnagBreadcrumbConstructorLike;
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
