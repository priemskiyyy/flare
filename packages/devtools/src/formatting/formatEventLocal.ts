import type { ReporterCapabilities } from "@priemskiyyy/flare";

const PARTS = ["user", "tags", "contexts", "breadcrumbs"] as const;

/** Which parts of a report the provider can attach to one event, without touching global state. */
export const formatEventLocal = (
  eventLocal: ReporterCapabilities["eventLocal"],
) => {
  const supported = PARTS.filter((part) => eventLocal[part]);

  if (supported.length === 0) {
    return "nothing";
  }

  return supported.join(", ");
};
