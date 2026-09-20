/**
 * The part of `fetch` the reporter uses, so React Native, Node and tests can
 * supply their own. The global `fetch` satisfies it.
 *
 * @example
 * ```ts
 * http({ endpoint: "/api/error-reports", fetch: nitroFetch });
 * ```
 */
export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
