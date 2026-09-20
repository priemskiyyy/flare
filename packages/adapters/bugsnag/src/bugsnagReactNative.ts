import type { BugsnagLike } from "src/types/BugsnagLike";
import type { BugsnagReporterOptions } from "src/types/BugsnagReporterOptions";
import { createBugsnagReporter } from "src/utils/createBugsnagReporter";

/**
 * Sends reports to Bugsnag on React Native, through the SDK the application
 * injects. The mapping is the browser's. What differs is the queue: the
 * native layer stores events on the device and sends them later. Native
 * crashes stay Bugsnag's own, and JavaScript callbacks do not see them.
 *
 * @example
 * ```ts
 * import Bugsnag, { Breadcrumb } from "@bugsnag/react-native";
 * import { bugsnag } from "@priemskiyyy/flare-bugsnag/react-native";
 *
 * Bugsnag.start();
 * const flare = new Flare({ destinations: { bugsnag: bugsnag({ sdk: Bugsnag, Breadcrumb }) } });
 * ```
 */
export const bugsnag = <TSdk extends BugsnagLike>(
  options: BugsnagReporterOptions<TSdk>,
) => createBugsnagReporter(options, { queue: "sdk-persistent" });
