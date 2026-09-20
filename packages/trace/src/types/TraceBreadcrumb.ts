/** What a mapper makes of one event: a breadcrumb name, and only the data it chose to copy. */
export type TraceBreadcrumb = {
  name: string;
  data?: Record<string, unknown>;
};
