import type { FlushResult } from "src/types/FlushResult";

/**
 * How far one destination got during `flush`. `unsupported` means the adapter
 * has no flush boundary at all, and `not-ready` that the destination is not
 * started. `timeout` bounds the wait; it neither cancels provider work nor
 * proves that a report was not sent.
 */
export type DestinationFlushResult =
  FlushResult | { status: "unsupported" } | { status: "not-ready" };
