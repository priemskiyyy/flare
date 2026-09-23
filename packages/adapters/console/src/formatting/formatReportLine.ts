import type { SanitizedReport } from "@priemskiyyy/flare";

const describeSubject = (report: SanitizedReport) => {
  if (report.kind === "message") {
    return report.message;
  }

  const { name, message } = report.exception;

  if (message === "") {
    return name;
  }

  return `${name}: ${message}`;
};

/** A one line summary of a report. The report is already redacted, so the line is too. */
export const formatReportLine = (report: SanitizedReport) => {
  const line = `[flare] ${report.level} ${describeSubject(report)}`;

  if (report.operation === null) {
    return line;
  }

  return `${line} (${report.operation})`;
};
