import type { FlareLevel, SanitizedReport } from "@priemskiyyy/flare";

export type ConsoleLine = {
  id: number;
  level: FlareLevel;
  line: string;
  report: SanitizedReport;
  at: number;
};
