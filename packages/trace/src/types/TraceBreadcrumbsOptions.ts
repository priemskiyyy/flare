import type { BreadcrumbTarget } from "src/types/BreadcrumbTarget";
import type { TraceBreadcrumbMap } from "src/types/TraceBreadcrumbMap";
import type { TraceEventSource } from "src/types/TraceEventSource";

/**
 * Options for `traceBreadcrumbs()`.
 *
 * @example
 * ```ts
 * traceBreadcrumbs({ source: trace.events, flare, map });
 * ```
 */
export type TraceBreadcrumbsOptions<TEvents extends Record<string, unknown>> = {
  source: TraceEventSource<TEvents>;
  flare: BreadcrumbTarget;
  map: TraceBreadcrumbMap<TEvents>;
  /** The clock that decides what occurred before bridging began. Defaults to `Date.now`. */
  now?: () => number;
};
