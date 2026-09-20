import type { ContextsOf } from "src/types/ContextsOf";
import type { DestinationName } from "src/types/DestinationName";
import type { Destinations } from "src/types/Destinations";
import type { FlarePrivacy } from "src/types/FlarePrivacy";
import type { FlareSchema } from "src/types/FlareSchema";
import type { SanitizedReport } from "src/types/SanitizedReport";
import type { TagsOf } from "src/types/TagsOf";

type Routing<TName extends string> =
  | {
      /** Where a report goes unless `to` says otherwise. Omitted, it is every destination. */
      default?: readonly TName[];
      route?: never;
    }
  | {
      /** Chooses destinations per report. If it throws, the report is dropped, never widened. */
      route: (input: { report: SanitizedReport }) => readonly TName[];
      default?: never;
    };

/**
 * Configuration of a `Flare`. Constructing one is cheap and starts nothing.
 *
 * @example
 * ```ts
 * const flare = new Flare({
 *   destinations: { sentry: sentry({ sdk: Sentry }), backend: http({ endpoint: "/api/errors" }) },
 *   default: ["sentry", "backend"],
 * });
 * ```
 */
export type FlareOptions<
  TDestinations extends Destinations = Destinations,
  TSchema extends FlareSchema = FlareSchema,
> = Routing<DestinationName<TDestinations>> & {
  destinations: TDestinations;
  schema?: TSchema;
  /** Application-wide metadata. Unlike session state, it survives an account switch. */
  defaults?: {
    tags?: Partial<TagsOf<TSchema>>;
    contexts?: Partial<ContextsOf<TSchema>>;
  };
  privacy?: FlarePrivacy;
  /** Reports captured before a destination is ready. Defaults to 30 reports and 60 seconds. */
  buffer?: { maxReports?: number; maxAgeMs?: number };
  /** How long one destination may take before its outcome is `indeterminate`. Defaults to 5000. */
  deadlineMs?: number;
  /** `windowMs: 0` turns object identity dedupe off. Defaults to 1000 ms and 100 keys per destination. History resets when the identity changes. */
  dedupe?: { windowMs?: number; maxKeys?: number };
  /** Protection against error storms. Defaults to 120 reports a minute. */
  limits?: { reportsPerMinute?: number };
  /** The clock, for tests. Defaults to `Date.now`. */
  now?: () => number;
};
