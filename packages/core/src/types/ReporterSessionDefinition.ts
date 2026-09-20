import type { ReporterSession } from "src/types/ReporterSession";

/**
 * Provider mapping returned by `createReporterAdapter`'s `open`. Omit
 * `dispose` when there is nothing to release beyond registered cleanups.
 * The resulting `ReporterSession` always has an idempotent `dispose`.
 *
 * @example
 * ```ts
 * open: () => ({ native: sdk, submit });
 * ```
 */
export type ReporterSessionDefinition<TNative = unknown> = Omit<
  ReporterSession<TNative>,
  "dispose"
> & {
  dispose?: ReporterSession<TNative>["dispose"];
};
