import type { FlareLevel } from "@priemskiyyy/flare";

/** OpenTelemetry's severity number and text for each Flare level. */
export const SEVERITIES = {
  fatal: { severityNumber: 21, severityText: "FATAL" },
  error: { severityNumber: 17, severityText: "ERROR" },
  warning: { severityNumber: 13, severityText: "WARN" },
  info: { severityNumber: 9, severityText: "INFO" },
} satisfies Record<
  FlareLevel,
  { severityNumber: number; severityText: string }
>;
