import type { SentryLike } from "src/types/SentryLike";
import type { SentryReporterOptions } from "src/types/SentryReporterOptions";
import { createSentryReporter } from "src/utils/createSentryReporter";

/**
 * Sends reports to Sentry in the browser, through the SDK the application
 * injects. Each report is mapped after scope composition, so its user, tags,
 * contexts and breadcrumbs never change Sentry's shared scopes.
 *
 * @example
 * ```ts
 * import * as Sentry from "@sentry/browser";
 *
 * Sentry.init({ dsn });
 * const flare = new Flare({ destinations: { sentry: sentry({ sdk: Sentry }) } });
 * ```
 */
export const sentry = <TSdk extends SentryLike>(
  options: SentryReporterOptions<TSdk>,
) => createSentryReporter(options, { flush: "sdk-queue", queue: "sdk-memory" });
