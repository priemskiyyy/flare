import type { StandardSchema } from "src/types/StandardSchema";
import type { TagValue } from "src/types/TagValue";

/**
 * Types the application's deliberate metadata. With a schema, only the
 * declared tag, context and breadcrumb names are accepted, and each value is
 * validated. Without one, any name is accepted.
 *
 * @example
 * ```ts
 * const schema = {
 *   tags: { area: z.enum(["upload", "editor"]) },
 *   contexts: { upload: z.object({ attempt: z.number() }) },
 *   breadcrumbs: { uploadStarted: z.object({ kind: z.string() }) },
 * } satisfies FlareSchema;
 * ```
 */
export type FlareSchema = {
  tags?: Record<string, StandardSchema<unknown, TagValue>>;
  contexts?: Record<string, StandardSchema<unknown, Record<string, unknown>>>;
  breadcrumbs?: Record<
    string,
    StandardSchema<unknown, Record<string, unknown>>
  >;
};
