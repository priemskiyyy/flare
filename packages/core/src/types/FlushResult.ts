/** What an adapter answers when asked to flush, up to the boundary its capabilities name. */
export type FlushResult =
  | { status: "flushed" }
  | { status: "timeout" }
  | { status: "failed"; error: unknown };
