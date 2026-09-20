/**
 * One thing that happened inside Flare. `type` is a short phrase such as
 * `report accepted`, `report dropped`, `destination outcome` or `identity
 * changed`. `context` holds ids, reasons and counts, never report content.
 *
 * @example
 * ```ts
 * flare.diagnostics.events.subscribe((event) => console.debug(event.type, event.context));
 * ```
 */
export type FlareDiagnosticEvent = {
  source: "runtime" | "session" | "report" | "destination";
  type: string;
  destination: string | null;
  /** The report id, when the event belongs to one. */
  report: string | null;
  timestamp: number;
  context: unknown;
};
