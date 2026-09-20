import type { ReporterAdapter } from "src/types/ReporterAdapter";
import type { ReporterLifetime } from "src/types/ReporterLifetime";
import type { ReporterOpenContext } from "src/types/ReporterOpenContext";
import type { ReporterSessionDefinition } from "src/types/ReporterSessionDefinition";

/**
 * What `createReporterAdapter` takes: a `ReporterAdapter` whose `open` also
 * receives a lifetime. Anything registered on it is released if `open` fails
 * part way, or when the session is disposed. Each cleanup runs once.
 *
 * @example
 * ```ts
 * open: (context, lifetime) => {
 *   const stop = sdk.onError(handleError);
 *   lifetime.add(stop);
 *   return { native: sdk, submit };
 * };
 * ```
 */
export type ReporterAdapterDefinition<TNative = unknown> = Omit<
  ReporterAdapter<TNative>,
  "open" | "available"
> & {
  /** Omit when the provider is always available in the supported environment. */
  available?: ReporterAdapter<TNative>["available"];
  open: (
    context: ReporterOpenContext,
    lifetime: ReporterLifetime,
  ) =>
    | ReporterSessionDefinition<TNative>
    | Promise<ReporterSessionDefinition<TNative>>;
};
