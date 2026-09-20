import type { ContextsOf } from "src/types/ContextsOf";
import type { FlareLevel } from "src/types/FlareLevel";
import type { FlareSchema } from "src/types/FlareSchema";
import type { FlareUser } from "src/types/FlareUser";
import type { TagsOf } from "src/types/TagsOf";

/**
 * Metadata for one report or one operation scope. It is event-local: it never
 * changes the session, and no other report can see it. A `null` user or
 * operation clears the inherited one for that report only.
 */
export type ReportOptions<TSchema extends FlareSchema = FlareSchema> = {
  tags?: Partial<TagsOf<TSchema>>;
  contexts?: Partial<ContextsOf<TSchema>>;
  user?: FlareUser | null;
  /** The active operation or screen, such as `upload-avatar`. */
  operation?: string | null;
  level?: FlareLevel;
};
