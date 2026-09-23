/**
 * The reference your backend gave a report, when it gives one. It becomes the
 * receipt's `event.id`.
 *
 * @example
 * ```ts
 * const acknowledgement: HttpAcknowledgement = { id: "evt_1" };
 * ```
 */
export type HttpAcknowledgement = {
  id: string;
};
