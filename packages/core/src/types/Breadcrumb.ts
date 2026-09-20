/**
 * One step of error-relevant history, already sanitized. `timestamp` is when
 * it happened, in epoch milliseconds.
 *
 * @example
 * ```ts
 * flare.breadcrumb("uploadStarted", { kind: "avatar" });
 * ```
 */
export type Breadcrumb = {
  readonly name: string;
  readonly data: Readonly<Record<string, unknown>> | null;
  readonly timestamp: number;
};
