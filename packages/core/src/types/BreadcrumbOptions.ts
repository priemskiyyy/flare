/**
 * Options for one breadcrumb.
 *
 * @example
 * ```ts
 * flare.breadcrumb("checkoutStarted", { cart: { id: cartId } }, { timestamp: event.timestamp });
 * ```
 */
export type BreadcrumbOptions = {
  /**
   * When it happened, in epoch milliseconds, for a breadcrumb recorded after
   * the fact. Defaults to now. A breadcrumb that occurred before the current
   * identity began is not kept: it belongs to the previous account.
   */
  timestamp?: number;
};
