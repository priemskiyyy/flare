import type { DestinationFlushResult } from "src/types/DestinationFlushResult";

/**
 * What `flush()` reached. `drained` says whether every submission accepted
 * before the call settled in time; `destinations` says how far each provider's
 * own flush got.
 *
 * @example
 * ```ts
 * const { drained, destinations } = await flare.flush({ timeoutMs: 1500 });
 * ```
 */
export type FlareFlushResult<TName extends string = string> = {
  drained: boolean;
  destinations: Partial<Record<TName, DestinationFlushResult>>;
};
