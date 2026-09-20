/** Whether a destination can run here, for example a native SDK in a browser. */
export type ReporterAvailability =
  { available: true } | { available: false; reason: string };
