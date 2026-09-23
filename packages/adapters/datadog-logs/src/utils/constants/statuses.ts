import type { FlareLevel } from "@priemskiyyy/flare";

import type { DatadogLogStatus } from "src/types/DatadogLogStatus";

/** Datadog's log status for each Flare level. Datadog has no fatal, so it is critical. */
export const STATUSES = {
  fatal: "critical",
  error: "error",
  warning: "warn",
  info: "info",
} satisfies Record<FlareLevel, DatadogLogStatus>;
