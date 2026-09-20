import type { CaptureOptions } from "src/types/CaptureOptions";
import type { FlareSchema } from "src/types/FlareSchema";
import type { Receipt } from "src/types/Receipt";

/**
 * The signature of `capture` and of `message`.
 *
 * It is read off a method on purpose. TypeScript compares a method's
 * parameters bivariantly, and that is what lets a Flare typed with its own
 * destinations and schema be used where an untyped `Flare` is expected, such
 * as a provider nothing was registered with. React's own typings use the same
 * device for event handlers.
 */
export type ReportFunction<
  TSubject,
  TName extends string,
  TSchema extends FlareSchema,
> = {
  bivariant(
    subject: TSubject,
    options?: CaptureOptions<TName, TSchema>,
  ): Receipt<TName>;
}["bivariant"];

/**
 * Metadata bound to one operation. A scope belongs to the identity it was
 * created under: after an account switch it is stale, and what it captures is
 * dropped as `stale-scope` rather than attributed to the new account.
 *
 * @example
 * ```ts
 * const upload = flare.scope({ tags: { area: "upload" } });
 * try {
 *   await uploadAvatar();
 * } catch (error) {
 *   upload.capture(error);
 * }
 * ```
 */
export type FlareScope<
  TName extends string = string,
  TSchema extends FlareSchema = FlareSchema,
> = {
  capture: ReportFunction<unknown, TName, TSchema>;
  message: ReportFunction<string, TName, TSchema>;
};
