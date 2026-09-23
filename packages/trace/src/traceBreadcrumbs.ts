import type { TraceBreadcrumbsOptions } from "src/types/TraceBreadcrumbsOptions";
import type { TraceEvent } from "src/types/TraceEvent";

/**
 * Turns selected Trace events into Flare breadcrumbs, and returns the
 * function that stops it. Only mapped events are bridged, only the data a
 * mapper returns is copied, and each breadcrumb keeps the time its event
 * occurred. Events that occurred before bridging began are ignored, so a
 * source that replays its history adds nothing. Flare itself refuses a
 * breadcrumb that occurred before the current identity began, and redacts
 * what a mapper returns like any other breadcrumb.
 *
 * It is passive: it starts nothing and creates no report.
 *
 * @example
 * ```ts
 * const stop = traceBreadcrumbs({
 *   source: trace.events,
 *   flare,
 *   map: {
 *     "checkout.started": ({ cartId }) => ({ name: "checkoutStarted", data: { cartId } }),
 *   },
 * });
 * ```
 */
export const traceBreadcrumbs = <TEvents extends Record<string, unknown>>({
  source,
  flare,
  map,
  now = Date.now,
}: TraceBreadcrumbsOptions<TEvents>) => {
  const bridgedSince = now();
  let stopped = false;

  const handleEvent = (event: TraceEvent<TEvents>) => {
    if (stopped) {
      return;
    }

    try {
      // A source written in plain JavaScript can deliver anything at all.
      if (typeof event !== "object" || event === null) {
        return;
      }

      const { name, timestamp } = event;

      if (typeof name !== "string" || typeof timestamp !== "number") {
        return;
      }

      // An unknown occurrence time cannot safely be attributed to an account.
      if (!Number.isFinite(timestamp) || timestamp < bridgedSince) {
        return;
      }

      if (!Object.hasOwn(map, name)) {
        return;
      }

      const mapper = map[name];

      if (typeof mapper !== "function") {
        return;
      }

      const breadcrumb = mapper(event.properties);

      if (breadcrumb === null) {
        return;
      }

      flare.breadcrumb(breadcrumb.name, breadcrumb.data, { timestamp });
    } catch {
      // Bad event data or a failing mapper costs only this breadcrumb.
      return;
    }
  };

  const unsubscribe = source.subscribe(handleEvent);

  return () => {
    if (stopped) {
      return;
    }

    stopped = true;
    unsubscribe();
  };
};
