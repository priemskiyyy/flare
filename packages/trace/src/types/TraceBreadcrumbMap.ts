import type { TraceBreadcrumb } from "src/types/TraceBreadcrumb";

/**
 * Which events become breadcrumbs, and what each one carries. An event with
 * no entry is ignored, and there is deliberately no way to pass every event
 * or every property through: analytics properties are not error context
 * until someone decides they are. Returning `null` declines one event.
 *
 * @example
 * ```ts
 * const map: TraceBreadcrumbMap<Events> = {
 *   "checkout.started": ({ cartId }) => ({ name: "checkoutStarted", data: { cartId } }),
 * };
 * ```
 */
export type TraceBreadcrumbMap<TEvents extends Record<string, unknown>> = {
  [TName in keyof TEvents & string]?: (
    properties: TEvents[TName],
  ) => TraceBreadcrumb | null;
};
