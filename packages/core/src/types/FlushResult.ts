/** What an adapter answers when asked to flush its provider's queue. */
export type FlushResult =
  | { status: "flushed" }
  | { status: "timeout" }
  | { status: "failed"; error: unknown };
