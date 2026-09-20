/**
 * The event fields mapped by {@link SentryScopeLike.addEventProcessor} after
 * Sentry combines its scopes. Unrelated SDK fields are preserved.
 *
 * @example
 * ```ts
 * const event: SentryEventLike = { user: { id: "ada" }, tags: { plan: "pro" } };
 * ```
 */
export type SentryEventLike = {
  /** User attached to this event. An empty object represents an anonymous report. */
  user?: { id?: string | number; email?: string; username?: string };
  /** Severity displayed by Sentry. */
  level?: "fatal" | "error" | "warning" | "log" | "info" | "debug";
  /** Searchable attributes, including Flare's report identifier. */
  tags?: Record<
    string,
    string | number | boolean | bigint | symbol | null | undefined
  >;
  /** Structured metadata, replaced by context name. */
  contexts?: Record<string, Record<string, unknown> | undefined>;
  /** The operation during which the report was captured. */
  transaction?: string;
  /** Provider breadcrumbs combined with Flare's capture-time snapshot. */
  breadcrumbs?: Array<{
    category?: string;
    message?: string;
    level?: NonNullable<SentryEventLike["level"]>;
    data?: Record<string, unknown>;
    /** Seconds since the epoch. */
    timestamp?: number;
  }>;
};
