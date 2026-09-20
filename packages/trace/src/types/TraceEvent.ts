/**
 * One event as Trace delivers it to a subscriber: a union over the event map,
 * discriminated by `name`, so a mapper for one event is typed with that
 * event's properties.
 *
 * @example
 * ```ts
 * type Events = { "checkout.started": { cartId: string } };
 * const event: TraceEvent<Events> = { name: "checkout.started", properties: { cartId: "c1" }, timestamp: Date.now() };
 * ```
 */
export type TraceEvent<TEvents extends Record<string, unknown>> = {
  [TName in keyof TEvents & string]: {
    name: TName;
    properties: TEvents[TName];
    /** Epoch milliseconds when the event occurred, not when it was delivered. */
    timestamp: number;
  };
}[keyof TEvents & string];
