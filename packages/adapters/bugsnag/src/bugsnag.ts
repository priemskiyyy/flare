import type { BugsnagLike } from "src/types/BugsnagLike";
import type { BugsnagReporterOptions } from "src/types/BugsnagReporterOptions";
import { createBugsnagReporter } from "src/utils/createBugsnagReporter";

/**
 * Sends reports to Bugsnag in the browser, through the SDK the application
 * injects. Each report is written inside the `onError` callback of its own
 * `notify` call, onto an event Bugsnag built from a copy of the client, so
 * its user, metadata and breadcrumbs never reach the client.
 *
 * @example
 * ```ts
 * import Bugsnag, { Breadcrumb } from "@bugsnag/js";
 *
 * Bugsnag.start({ apiKey });
 * const flare = new Flare({ destinations: { bugsnag: bugsnag({ sdk: Bugsnag, Breadcrumb }) } });
 * ```
 */
export const bugsnag = <TSdk extends BugsnagLike>(
  options: BugsnagReporterOptions<TSdk>,
  // The browser notifier delivers at once and keeps nothing for later.
) => createBugsnagReporter(options, { queue: "none" });
