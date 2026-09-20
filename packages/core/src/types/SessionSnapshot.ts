import type { Breadcrumb } from "src/types/Breadcrumb";
import type { FlareUser } from "src/types/FlareUser";
import type { TagValue } from "src/types/TagValue";

/** Everything the current session contributes to a report, already sanitized and frozen. */
export type SessionSnapshot = {
  readonly generation: number;
  readonly user: Readonly<FlareUser> | null;
  readonly tags: Readonly<Record<string, TagValue>>;
  readonly contexts: Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >;
  readonly breadcrumbs: readonly Breadcrumb[];
};
