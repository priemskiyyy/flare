import type { ContextsOf } from "src/types/ContextsOf";
import type { DestinationName } from "src/types/DestinationName";
import type { Destinations } from "src/types/Destinations";
import type { FlarePrivacy } from "src/types/FlarePrivacy";
import type { FlareSchema } from "src/types/FlareSchema";
import type { SanitizedReport } from "src/types/SanitizedReport";
import type { TagsOf } from "src/types/TagsOf";

/**
 * Configuration of a `Flare`. Constructing one is cheap and starts nothing.
 *
 * @example
 * ```ts
 * const flare = new Flare({
 *   destinations: { sentry: sentry({ sdk: Sentry }), backend: http({ request: sendReport }) },
 *   defaults: { to: ["sentry", "backend"] },
 * });
 * ```
 */
export type FlareOptions<
  TDestinations extends Destinations = Destinations,
  TSchema extends FlareSchema = FlareSchema,
> = {
  destinations: TDestinations;
  schema?: TSchema;
  /**
   * What a report gets unless it says otherwise. Unlike session state, it
   * survives an account switch.
   *
   * `to` is where a report goes: a list, or a function that decides from the
   * finished report. Omitted, it is every destination. A report's own `to`
   * replaces it and never merges with it, and a function that throws drops
   * the report rather than widening it. A report's tags and contexts are
   * merged over these ones, key by key.
   */
  defaults?: {
    to?:
      | readonly DestinationName<TDestinations>[]
      | ((input: {
          report: SanitizedReport;
        }) => readonly DestinationName<TDestinations>[]);
    tags?: Partial<TagsOf<TSchema>>;
    contexts?: Partial<ContextsOf<TSchema>>;
  };
  privacy?: FlarePrivacy;
  /**
   * Reports captured before a destination is ready. `capacity` is how many
   * each destination holds, and `maxAge` how long one may wait, in
   * milliseconds as everywhere in Flare. Defaults to 30 reports and 60 seconds.
   */
  buffer?: { capacity?: number; maxAge?: number };
  /** How long one destination may take before its outcome is `indeterminate`. Defaults to 5000. */
  timeout?: number;
  /**
   * `window` is how long the same thrown object counts as a duplicate, and `0`
   * turns that off. Defaults to 1000 ms; history resets when the identity
   * changes.
   */
  dedupe?: { window?: number };
  /** Protection against error storms. Defaults to 120 reports a minute. */
  rateLimits?: { perMinute?: number };
  /** The clock, for tests. Defaults to `Date.now`. */
  now?: () => number;
};
