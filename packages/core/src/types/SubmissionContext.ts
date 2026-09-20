/** What an adapter is told alongside each report. */
export type SubmissionContext = {
  /** Aborts at the deadline and on disposal, so a transport can stop waiting. */
  signal: AbortSignal;
  /**
   * The identity generation right now. A report buffered under one account
   * carries its own generation; a transport that authenticates as the current
   * account compares the two before sending.
   */
  currentGeneration: () => number;
};
