// Inlined rather than depended on, even as types: core ships zero dependencies.
type StandardSchemaResult<TValue> =
  | { value: TValue; issues?: undefined }
  | { issues: ReadonlyArray<{ message: string }> };

/**
 * The part of the Standard Schema v1 contract Flare reads: a validator that
 * answers with the value or with issues. Zod, Valibot and ArkType all
 * implement it. Validation must be synchronous, because `capture()` is.
 *
 * @example
 * ```ts
 * const schema = { tags: { area: z.enum(["upload", "editor"]) } };
 * ```
 */
export type StandardSchema<TInput = unknown, TOutput = TInput> = {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    /** Input is what callers supply; output is what Flare sanitizes and retains. */
    readonly types?:
      { readonly input: TInput; readonly output: TOutput } | undefined;
    readonly validate: (
      value: unknown,
    ) => StandardSchemaResult<TOutput> | Promise<StandardSchemaResult<TOutput>>;
  };
};
