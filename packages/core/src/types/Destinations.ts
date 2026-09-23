import type { ReporterAdapter } from "src/types/ReporterAdapter";

/** Named destinations. The names flow into `defaults.to`, a report's `to`, receipts and `destination()`. */
export type Destinations = Record<string, ReporterAdapter>;
