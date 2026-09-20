import type { Breadcrumb } from "src/types/Breadcrumb";
import type { FlareLevel } from "src/types/FlareLevel";
import type { FlareUser } from "src/types/FlareUser";
import type { MappingLoss } from "src/types/MappingLoss";
import type { NormalizedException } from "src/types/NormalizedException";
import type { TagValue } from "src/types/TagValue";

type ReportBase = {
  readonly id: string;
  /** When the report was captured, in epoch milliseconds. */
  readonly timestamp: number;
  readonly level: FlareLevel;
  /** The identity the report was captured under. It never changes afterwards. */
  readonly identity: {
    readonly generation: number;
    readonly user: Readonly<FlareUser> | null;
  };
  readonly tags: Readonly<Record<string, TagValue>>;
  readonly contexts: Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >;
  readonly breadcrumbs: readonly Breadcrumb[];
  readonly operation: string | null;
  /** What the core could not carry as given: truncation and schema rejections. */
  readonly losses: readonly MappingLoss[];
};

/**
 * The only thing an adapter ever receives: frozen, bounded, redacted plain
 * data. The thrown value itself never leaves the core.
 *
 * @example
 * ```ts
 * submit: (report) => {
 *   if (report.kind === "message") {
 *     return send(report.message);
 *   }
 *   return send(report.exception.name);
 * };
 * ```
 */
export type SanitizedReport = ReportBase &
  (
    | { readonly kind: "exception"; readonly exception: NormalizedException }
    | { readonly kind: "message"; readonly message: string }
  );
