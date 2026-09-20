import type { FlareSchema } from "src/types/FlareSchema";
import type { InferStandardSchema } from "src/types/InferStandardSchema";

/** The contexts a schema declares, or any named object when it declares none. */
export type ContextsOf<TSchema extends FlareSchema> =
  TSchema["contexts"] extends Record<string, unknown>
    ? {
        [TName in keyof TSchema["contexts"]]: InferStandardSchema<
          TSchema["contexts"][TName]
        >;
      }
    : Record<string, Record<string, unknown>>;
