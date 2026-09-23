/** What an adapter is told when asked to flush. */
export type FlushContext = {
  timeout: number;
  /** Aborts when the timeout passes. It bounds the wait, it does not cancel provider work. */
  signal: AbortSignal;
};
