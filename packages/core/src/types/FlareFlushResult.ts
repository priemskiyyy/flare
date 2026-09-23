import type { DestinationFlushResult } from "src/types/DestinationFlushResult";

/**
 * What `flush()` reached. `drained` says whether every submission accepted
 * before the call settled in time; `destinations` says how far each provider's
 * own flush got.
 *
 * @example
 * ```ts
 * const { drained, destinations } = await flare.flush({ timeout: 1500 });
 * ```
 */
export type FlareFlushResult<TName extends string = string> = {
  drained: boolean;
  destinations: Record<TName, DestinationFlushResult>;
};
