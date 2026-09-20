const VISIBLE_LENGTH = 8;

/** Enough of a report id to follow one report down the timeline. The whole id is in the row's title. */
export const formatReportId = (report: string | null) => {
  if (report === null) {
    return "";
  }

  return report.slice(0, VISIBLE_LENGTH);
};
