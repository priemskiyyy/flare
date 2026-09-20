import type { ReporterAdapter } from "src/types/ReporterAdapter";

/** Named destinations. The names flow into `default`, `route`, `to`, receipts and `destination()`. */
export type Destinations = Record<string, ReporterAdapter>;
