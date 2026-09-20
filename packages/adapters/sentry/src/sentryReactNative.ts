import type { SentryLike } from "src/types/SentryLike";
import type { SentryReporterOptions } from "src/types/SentryReporterOptions";
import { createSentryReporter } from "src/utils/createSentryReporter";

/**
 * Sends reports to Sentry on React Native, through the SDK the application
 * injects. The mapping is the browser's; what differs is what `flush` and the
 * queue can honestly promise. Native crashes stay Sentry's own.
 *
 * @example
 * ```ts
 * import * as Sentry from "@sentry/react-native";
 * import { sentry } from "@priemskiyyy/flare-sentry/react-native";
 *
 * Sentry.init({ dsn });
 * const flare = new Flare({ destinations: { sentry: sentry({ sdk: Sentry }) } });
 * ```
 */
export const sentry = <TSdk extends SentryLike>(
  options: SentryReporterOptions<TSdk>,
) =>
  createSentryReporter(options, {
    flush: "native-handoff",
    queue: "sdk-persistent",
  });
