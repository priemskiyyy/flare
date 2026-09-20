import type { FlareSchema } from "src/types/FlareSchema";
import type { ReportOptions } from "src/types/ReportOptions";

/**
 * Options for one `capture()` or `message()`.
 *
 * @example
 * ```ts
 * flare.capture(error, { to: ["backend"], tags: { area: "upload" }, dedupe: { key: "upload-failed" } });
 * ```
 */
export type CaptureOptions<
  TName extends string = string,
  TSchema extends FlareSchema = FlareSchema,
> = ReportOptions<TSchema> & {
  /** Replaces the default route for this report. It never merges with it. */
  to?: readonly TName[];
  /** A later report with the same key is not sent again to a destination that already has it. */
  dedupe?: { key: string };
};
