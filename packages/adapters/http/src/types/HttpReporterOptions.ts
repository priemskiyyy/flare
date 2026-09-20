import type { FlareUser } from "@priemskiyyy/flare";

import type { FetchLike } from "src/types/FetchLike";

type Headers = Record<string, string>;

/**
 * Options for `http()`.
 *
 * @example
 * ```ts
 * http({
 *   endpoint: "/api/error-reports",
 *   authorize: () => ({ authorization: `Bearer ${session.token}` }),
 * });
 * ```
 */
export type HttpReporterOptions = {
  /** Where each report is posted. */
  endpoint: string;
  /** Headers for every request, or a function answering them per request, awaited. Use `authorize` for credentials. Names are case insensitive; credentials override shared headers, and Flare owns content-type and idempotency-key. */
  headers?: Headers | (() => Headers | Promise<Headers>);
  /**
   * Answers the credentials of the current account. It is only asked while
   * the report still belongs to that account: a report captured under a
   * previous identity is skipped as `auth-subject-mismatch` instead of being
   * sent with someone else's credentials.
   */
  authorize?: (context: {
    user: FlareUser | null;
  }) => Headers | Promise<Headers>;
  /** The fetch to use. Omitted, `globalThis.fetch` is read when a report is sent, so a polyfill installed later is honoured. */
  fetch?: FetchLike;
};
