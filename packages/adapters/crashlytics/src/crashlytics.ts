import { createReporterAdapter, rebuildError } from "@priemskiyyy/flare";
import type { ReporterCapabilities } from "@priemskiyyy/flare";

import type { CrashlyticsReporterOptions } from "src/types/CrashlyticsReporterOptions";
import { assertUnreachable } from "src/utils/assertUnreachable";
import { createAmbientMirror } from "src/utils/createAmbientMirror";
import { getReportLosses } from "src/utils/getReportLosses";

const CAPABILITIES: ReporterCapabilities = {
  // recordError takes an Error and nothing else. Setting the global user or
  // keys around the call would leak into every other report, so it is not done.
  eventLocal: { user: false, tags: false, contexts: false, breadcrumbs: false },
  messages: false,
  evidence: "sdk-call-returned",
  // sendUnsentReports acknowledges nothing, so it is not a flush.
  flush: "none",
  // A non-fatal is stored on the device and usually sent on the next launch.
  queue: "sdk-persistent",
  automaticCapture: "provider-owned",
  instance: "singleton",
  // Collection can be disabled, in which case nothing recorded is ever sent.
  filtering: "provider-hooks",
};

/**
 * Records non-fatal errors in Firebase Crashlytics on React Native, through
 * the module the application injects. Crashlytics can attach nothing to one
 * report, and this reporter does not pretend otherwise: what a report carries
 * beyond its error is listed on the receipt as a loss. User, keys and logs
 * reach Crashlytics only through the opt-in ambient integration.
 *
 * @example
 * ```ts
 * import * as Crashlytics from "@react-native-firebase/crashlytics";
 *
 * const flare = new Flare({
 *   destinations: { crashlytics: crashlytics({ sdk: Crashlytics }) },
 * });
 * ```
 */
export const crashlytics = <TInstance>({
  sdk,
  ambient = {},
}: CrashlyticsReporterOptions<TInstance>) =>
  createReporterAdapter<TInstance>({
    name: "crashlytics",
    capabilities: CAPABILITIES,
    singleton: sdk,
    open: (_context, lifetime) => {
      const instance = sdk.getCrashlytics();
      const mirror = createAmbientMirror(sdk, instance, ambient);

      lifetime.add(mirror.clear);

      return {
        native: instance,
        submit: (report) => {
          if (report.kind === "message") {
            return { status: "skipped", reason: "unsupported-report-kind" };
          }

          if (report.kind !== "exception") {
            return assertUnreachable(report);
          }

          // Crashlytics attaches its global user id natively. Where Flare
          // wrote that id, a report that belongs to someone else would be
          // recorded under the wrong account, so it is not recorded at all.
          const reportUserId = report.identity.user?.id ?? null;

          if (ambient.user === true && reportUserId !== mirror.userId()) {
            return { status: "skipped", reason: "identity-mismatch" };
          }

          sdk.recordError(instance, rebuildError(report.exception));

          return {
            status: "submitted",
            evidence: "sdk-call-returned",
            losses: getReportLosses(report),
          };
        },
        ...(mirror.context === undefined ? {} : { ambient: mirror.context }),
      };
    },
  });
