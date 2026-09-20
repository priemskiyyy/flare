import type { MappingLoss } from "src/types/MappingLoss";
import type { SanitizedReport } from "src/types/SanitizedReport";

// A report is frozen plain data by now, so serializing it runs no application code.
const sizeOf = (value: unknown) => JSON.stringify(value).length;

/**
 * Keeps a report within the estimated size limit by shedding the oldest
 * breadcrumbs first and then the most recently added contexts. What the
 * report is about is never shed; its own bounds are applied earlier.
 */
export const fitReport = (
  report: SanitizedReport,
  totalSize: number,
): SanitizedReport => {
  let excess = sizeOf(report) - totalSize;
  if (excess <= 0) {
    return report;
  }

  const breadcrumbs = [...report.breadcrumbs];
  const contexts = { ...report.contexts };
  const losses: MappingLoss[] = [];

  while (excess > 0 && breadcrumbs.length > 0) {
    excess -= sizeOf(breadcrumbs.shift());
  }
  if (breadcrumbs.length < report.breadcrumbs.length) {
    losses.push({ path: "breadcrumbs", reason: "truncated" });
  }

  for (const name of Object.keys(contexts).reverse()) {
    if (excess <= 0) {
      break;
    }
    excess -= sizeOf(contexts[name]);
    delete contexts[name];
    losses.push({ path: `contexts.${name}`, reason: "truncated" });
  }

  return Object.freeze({
    ...report,
    breadcrumbs: Object.freeze(breadcrumbs),
    contexts: Object.freeze(contexts),
    losses: Object.freeze([
      ...report.losses,
      ...losses.map((loss) => Object.freeze(loss)),
    ]),
  });
};
