/**
 * The part of an OpenTelemetry `Logger` the adapter calls. A logger from
 * `@opentelemetry/api-logs` satisfies it, so the package does not import the
 * API: the application passes in the logger its provider made.
 *
 * @example
 * ```ts
 * import { logs } from "@opentelemetry/api-logs";
 *
 * opentelemetry({ logger: logs.getLogger("app") });
 * ```
 */
export type OpenTelemetryLoggerLike = {
  /**
   * Hands one log record to the provider's processors, which export it on
   * their own schedule. A method, so that the API's `LogRecord`, whose
   * attributes are typed as OpenTelemetry values, accepts the report's data,
   * which is plain JSON by construction but typed `unknown`.
   */
  emit(logRecord: {
    timestamp?: unknown;
    severityNumber?: number;
    severityText?: string;
    body?: unknown;
    attributes?: Record<string, unknown>;
  }): void;
};
