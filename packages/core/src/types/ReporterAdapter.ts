import type { ReporterSession } from "src/types/ReporterSession";

/**
 * Cold description of a destination. Creating one opens nothing: `open` runs
 * when the Flare starts. It returns a fresh session, or throws before it
 * changed anything, and a later `flare.start()` tries again.
 *
 * @example
 * ```ts
 * const beacon = ({ sdk }: { sdk: Beacon }): ReporterAdapter<Beacon> => ({
 *   name: "beacon",
 *   open: () => ({
 *     native: sdk,
 *     submit: (report) => {
 *       sdk.send(JSON.stringify(report));
 *       return { status: "submitted", evidence: "sdk-call-returned" };
 *     },
 *   }),
 * });
 * ```
 */
export type ReporterAdapter<TNative = unknown> = {
  /** For diagnostics only. The core never branches on it. */
  name: string;
  open: () => ReporterSession<TNative>;
};
