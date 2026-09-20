import type { FlareSchema } from "src/types/FlareSchema";
import type { InferStandardSchema } from "src/types/InferStandardSchema";
import type { TagValue } from "src/types/TagValue";

/** The tags a schema declares, or any scalar tag when it declares none. */
export type TagsOf<TSchema extends FlareSchema> =
  TSchema["tags"] extends Record<string, unknown>
    ? {
        [TKey in keyof TSchema["tags"]]: InferStandardSchema<
          TSchema["tags"][TKey]
        >;
      }
    : Record<string, TagValue>;
