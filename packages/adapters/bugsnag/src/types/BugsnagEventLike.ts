import type { BugsnagBreadcrumbLike } from "src/types/BugsnagBreadcrumbLike";

/**
 * The part of a Bugsnag `Event` the reporter writes to, inside the `onError`
 * callback of one `notify` call. Bugsnag builds the event from a copy of the
 * client's state, so nothing written here reaches the client.
 */
export type BugsnagEventLike = {
  severity: "info" | "warning" | "error";
  /** Bugsnag's display context: what the user was doing. Not a Flare context. */
  context?: string;
  breadcrumbs: BugsnagBreadcrumbLike[];
  setUser: (id?: string, email?: string, name?: string) => void;
  addMetadata: (section: string, values: Record<string, unknown>) => void;
  clearMetadata: (section: string) => void;
};
