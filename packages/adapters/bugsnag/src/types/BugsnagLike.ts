import type { BugsnagEventLike } from "src/types/BugsnagEventLike";

/**
 * The part of the static Bugsnag API the adapter calls. The default export
 * of `@bugsnag/js` and of `@bugsnag/react-native` both satisfy it, so the
 * package imports neither: the application passes in the one it started.
 *
 * @example
 * ```ts
 * import Bugsnag, { Breadcrumb } from "@bugsnag/js";
 *
 * bugsnag({ sdk: Bugsnag, Breadcrumb });
 * ```
 */
export type BugsnagLike = {
  /** `notify` only logs before `start`, and never calls back, so this is probed on open. */
  isStarted: () => boolean;
  notify: (
    error: Error,
    onError?: (event: BugsnagEventLike) => boolean | void,
    postReportCallback?: (error: unknown, event: BugsnagEventLike) => void,
  ) => void;
  setUser: (id?: string, email?: string, name?: string) => void;
  addMetadata: (section: string, values: Record<string, unknown>) => void;
  clearMetadata: (section: string, key?: string) => void;
  leaveBreadcrumb: (
    message: string,
    metadata?: Record<string, unknown>,
    type?: "manual",
  ) => void;
};
