import type { FlareSchema } from "src/types/FlareSchema";
import type { InferStandardSchema } from "src/types/InferStandardSchema";

/** The breadcrumbs a schema declares, or any named object when it declares none. */
export type BreadcrumbsOf<TSchema extends FlareSchema> =
  TSchema["breadcrumbs"] extends Record<string, unknown>
    ? {
        [TName in keyof TSchema["breadcrumbs"]]: InferStandardSchema<
          TSchema["breadcrumbs"][TName]
        >;
      }
    : Record<string, Record<string, unknown>>;
