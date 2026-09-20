/** The raw subject. It is consumed during preparation and never leaves the core. */
export type ReportSource =
  { kind: "exception"; thrown: unknown } | { kind: "message"; text: unknown };
