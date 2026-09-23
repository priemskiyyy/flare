export type NetworkRequest = {
  id: number;
  /** The report id, which the client sends as the idempotency key. */
  reportId: string;
  account: string | null;
  outcome: "accepted" | "failed" | "aborted";
  duration: number;
  at: number;
};
