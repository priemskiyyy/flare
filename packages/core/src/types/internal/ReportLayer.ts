import type { FlareLevel } from "src/types/FlareLevel";
import type { FlareUser } from "src/types/FlareUser";
import type { TagValue } from "src/types/TagValue";

/**
 * What one layer of the composition order contributes, already sanitized.
 * Absent fields inherit from the layer below;
 * a `null` user or operation deliberately clears it.
 */
export type ReportLayer = {
  user?: FlareUser | null;
  tags?: Record<string, TagValue>;
  contexts?: Record<string, Record<string, unknown>>;
  operation?: string | null;
  level?: FlareLevel;
};
