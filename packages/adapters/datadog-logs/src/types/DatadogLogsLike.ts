import type { DatadogLogStatus } from "src/types/DatadogLogStatus";

/**
 * The part of the browser Logs SDK the adapter calls. `datadogLogs` from
 * `@datadog/browser-logs` satisfies it, so the package does not import it:
 * the application passes in the instance it initialized.
 *
 * @example
 * ```ts
 * import { datadogLogs as browserLogs } from "@datadog/browser-logs";
 *
 * datadogLogs({ sdk: browserLogs });
 * ```
 */
export type DatadogLogsLike = {
  /** Undefined until `datadogLogs.init` has run. */
  getInitConfiguration: () => unknown;
  /** The user Datadog attaches to every log, as `setUser` and `clearUser` left it. */
  getUser: () => Record<string, unknown>;
  logger: {
    /**
     * Sends one log. Its context is merged over the global context and the
     * user, and the logger's level and handler, sampling, `beforeSend` and
     * rate limits can drop it without saying so.
     */
    log: (
      message: string,
      messageContext?: object,
      status?: DatadogLogStatus,
      error?: Error,
    ) => void;
  };
};
