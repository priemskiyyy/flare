import type { HttpAcknowledgement } from "src/types/HttpAcknowledgement";
import type { HttpRequest } from "src/types/HttpRequest";

/**
 * Options for `http()`. Your own client owns the transport: the address,
 * authentication, headers, body, retries and response handling.
 *
 * @example
 * ```ts
 * http({
 *   request: async ({ report, signal }) => {
 *     const { id } = await api.errorReports.create(report, { signal });
 *     return { id };
 *   },
 * });
 * ```
 */
export type HttpAdapterOptions = {
  /**
   * Sends one report. Resolve only once your backend has accepted it, with
   * the id it gave the report if it gives one; throw or reject when it has
   * not. Pass `signal` on, and send `report.id` as the idempotency key, so a
   * retry never files a report twice.
   */
  request: (
    request: HttpRequest,
  ) => HttpAcknowledgement | void | PromiseLike<HttpAcknowledgement | void>;
};
