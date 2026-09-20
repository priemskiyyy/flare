import type { RecordedEventKind } from "src/utils/getEventKind";

const LABELS: Record<RecordedEventKind, string> = {
  ERROR: "Errors",
  REPORT: "Reports",
  DESTINATION: "Destinations",
  SESSION: "Session",
  RUNTIME: "Runtime",
};

export const formatEventKind = (kind: RecordedEventKind) => LABELS[kind];
