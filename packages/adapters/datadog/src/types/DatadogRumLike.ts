/**
 * The part of the browser RUM SDK the adapter calls. `datadogRum` from
 * `@datadog/browser-rum` satisfies it, so the package does not import it: the
 * application passes in the instance it initialized.
 *
 * @example
 * ```ts
 * import { datadogRum } from "@datadog/browser-rum";
 *
 * datadog({ sdk: datadogRum });
 * ```
 */
export type DatadogRumLike = {
  /** Undefined until `datadogRum.init` has run. */
  getInitConfiguration: () => unknown;
  /** The user Datadog attaches to every event, as `setUser` and `clearUser` left it. */
  getUser: () => Record<string, unknown>;
  /**
   * Records an error with attributes for this one event. Datadog merges its
   * global context over them when it assembles the event, and sampling,
   * `beforeSend` and rate limits can still discard it without saying so.
   */
  addError: (error: unknown, context?: object) => void;
};
