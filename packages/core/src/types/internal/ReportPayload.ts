import type { NormalizedException } from "src/types/NormalizedException";

/** What a report is about: a failure, or an abnormal condition described in words. */
export type ReportPayload =
  | { kind: "exception"; exception: NormalizedException }
  | { kind: "message"; message: string };
