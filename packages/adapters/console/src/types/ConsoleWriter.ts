import type { FlareLevel, SanitizedReport } from "@priemskiyyy/flare";

/**
 * Receives each report. `line` is a one line summary and `report` the frozen,
 * already redacted report, for a writer that wants to print more.
 * A returned promise is awaited before the receipt settles. Other return
 * values are ignored, so existing logger methods can be passed directly.
 *
 * @example
 * ```ts
 * const writer: ConsoleWriter = ({ level, line }) => logger.log(level, line);
 * ```
 */
export type ConsoleWriter = (entry: {
  level: FlareLevel;
  line: string;
  report: SanitizedReport;
}) => void;
