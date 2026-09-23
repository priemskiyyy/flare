import type { SanitizedReport } from "@priemskiyyy/flare";

import { assertUnreachable } from "src/utils/assertUnreachable";

const describeSubject = (report: SanitizedReport) => {
  if (report.kind === "message") {
    return report.message;
  }

  if (report.kind !== "exception") {
    return assertUnreachable(report);
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
