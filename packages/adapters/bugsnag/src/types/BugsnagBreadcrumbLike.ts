/** The part of a Bugsnag `Breadcrumb` the adapter reads and writes. */
export type BugsnagBreadcrumbLike = {
  message: string;
  metadata: Record<string, unknown>;
  type: string;
  timestamp: Date;
};
