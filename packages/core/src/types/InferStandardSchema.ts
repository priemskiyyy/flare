import type { StandardSchema } from "src/types/StandardSchema";

/** The input a schema accepts, falling back to its output for validators without type metadata. */
export type InferStandardSchema<TSchema> = TSchema extends StandardSchema
  ? "types" extends keyof TSchema["~standard"]
    ? NonNullable<TSchema["~standard"]["types"]>["input"]
    : TSchema extends StandardSchema<unknown, infer TOutput>
      ? TOutput
      : never
  : never;
