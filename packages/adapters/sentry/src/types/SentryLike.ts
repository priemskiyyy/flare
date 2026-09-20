import type { SentryEventLike } from "src/types/SentryEventLike";
import type { SentryScopeLike } from "src/types/SentryScopeLike";

/**
 * The part of a Sentry SDK the reporter calls. `@sentry/browser`,
 * `@sentry/react` and `@sentry/react-native` all satisfy it, so the package
 * imports none of them: the application injects the one it already uses.
 *
 * @example
 * ```ts
 * import * as Sentry from "@sentry/browser";
 *
 * sentry({ sdk: Sentry });
 * ```
 */
export type SentryLike = {
  /** Replaces the ambient user, or clears it on sign-out. */
  setUser: (user: NonNullable<SentryEventLike["user"]> | null) => unknown;
  /** Merges ambient tags. An undefined value removes a mirrored tag. */
  setTags: (tags: NonNullable<SentryEventLike["tags"]>) => unknown;
  /** Replaces an ambient context, or clears it with null. */
  setContext: (
    name: string,
    context: Record<string, unknown> | null,
  ) => unknown;
  /** Adds one breadcrumb to the provider's ambient history. */
  addBreadcrumb: (
    breadcrumb: NonNullable<SentryEventLike["breadcrumbs"]>[number],
  ) => unknown;
  /** Forks the current scope for the callback, which is what keeps a report event-local. */
  withScope: (callback: (scope: SentryScopeLike) => void) => void;
  captureException: (exception: unknown) => string;
  captureMessage: (message: string) => string;
  /** React Native's `flush` takes no timeout; the core bounds the wait either way. */
  flush: (timeout?: number) => PromiseLike<boolean>;
  close: () => PromiseLike<unknown>;
  /** `undefined` until `Sentry.init` has run. React Native has no `isInitialized`. */
  getClient: () => unknown;
  /** Supplies the history cleared by the ambient mirror on an account switch. */
  getIsolationScope: () => { clearBreadcrumbs: () => unknown };
};
