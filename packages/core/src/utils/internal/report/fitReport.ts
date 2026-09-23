import type { MappingLoss } from "src/types/MappingLoss";
import type { SanitizedReport } from "src/types/SanitizedReport";

// A report is frozen plain data by now, so serializing it runs no application code.
const getSerializedLength = (value: unknown) => JSON.stringify(value).length;

// Breadcrumbs and contexts are frozen and shared by every report that carries
// them, so each is serialized once in its life instead of once per report.
const serializedSizes = new WeakMap<object, number>();

const getCachedSize = (value: object) => {
  const known = serializedSizes.get(value);

  if (known !== undefined) {
    return known;
  }

  const size = getSerializedLength(value);

  serializedSizes.set(value, size);

  return size;
};

const NO_BREADCRUMBS: SanitizedReport["breadcrumbs"] = Object.freeze([]);
const NO_CONTEXTS: SanitizedReport["contexts"] = Object.freeze({});

// The exact serialized length, assembled from the parts already measured.
const measureReport = (report: SanitizedReport) => {
  const contexts = Object.entries(report.contexts);

  let size = getSerializedLength({
    ...report,
    breadcrumbs: NO_BREADCRUMBS,
    contexts: NO_CONTEXTS,
  });

  for (const breadcrumb of report.breadcrumbs) {
    size += getCachedSize(breadcrumb);
  }

  for (const [name, context] of contexts) {
    size += getSerializedLength(name) + 1 + getCachedSize(context);
  }

  // Neighbours in a list are separated by one comma.
  const commas =
    Math.max(0, report.breadcrumbs.length - 1) +
    Math.max(0, contexts.length - 1);

  return size + commas;
};

/**
 * Keeps a report within the size limit by shedding the oldest
 * breadcrumbs first and then the most recently added contexts. What the
 * report is about is never shed; its own bounds are applied earlier.
 */
export const fitReport = (
  report: SanitizedReport,
  totalSize: number,
): SanitizedReport => {
  let excess = measureReport(report) - totalSize;

  if (excess <= 0) {
    return report;
  }

  const losses: MappingLoss[] = [];
  let shed = 0;

  for (const breadcrumb of report.breadcrumbs) {
    if (excess <= 0) {
      break;
    }

    excess -= getCachedSize(breadcrumb);
    shed += 1;
  }

  if (shed > 0) {
    losses.push({ path: "breadcrumbs", reason: "truncated" });
  }

  const contexts = { ...report.contexts };

  for (const [name, context] of Object.entries(report.contexts).reverse()) {
    if (excess <= 0) {
      break;
    }

    excess -= getCachedSize(context);
    delete contexts[name];
    losses.push({ path: `contexts.${name}`, reason: "truncated" });
  }

  return Object.freeze({
    ...report,
    breadcrumbs: Object.freeze(report.breadcrumbs.slice(shed)),
    contexts: Object.freeze(contexts),
    losses: Object.freeze([
      ...report.losses,
      ...losses.map((loss) => Object.freeze(loss)),
    ]),
  });
};
