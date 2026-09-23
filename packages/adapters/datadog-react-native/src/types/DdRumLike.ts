/**
 * The part of `DdRum` from `@datadog/mobile-react-native` the adapter calls.
 * The package does not import the SDK: the application passes in `DdRum`.
 *
 * @example
 * ```ts
 * import { DdRum } from "@datadog/mobile-react-native";
 *
 * datadog({ sdk: DdRum });
 * ```
 */
export type DdRumLike = {
  /**
   * Records an error from its message and stack trace, at the time it is
   * given. Before `DdSdkReactNative.initialize`, the call waits in a bounded
   * buffer of the SDK's own, and the error event mapper can still discard the
   * error without saying so.
   *
   * A method, so that the SDK's `ErrorSource` enum accepts the string the
   * adapter passes.
   */
  addError(
    message: string,
    source: string,
    stacktrace: string,
    context?: object,
    timestampMs?: number,
  ): Promise<void>;
};
