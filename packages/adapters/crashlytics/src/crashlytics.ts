import { SanitizedError } from "@priemskiyyy/flare";
import type {
  MappingLoss,
  ReporterAdapter,
  SanitizedReport,
} from "@priemskiyyy/flare";

import type { CrashlyticsAdapterOptions } from "src/types/CrashlyticsAdapterOptions";
import { createAmbientMirror } from "src/utils/createAmbientMirror";

type ExceptionReport = Extract<SanitizedReport, { kind: "exception" }>;

// Everything `recordError` has no argument for, listed even with the ambient
// integration on: what Crashlytics attaches then is its global state.
const getReportLosses = (report: ExceptionReport): MappingLoss[] => {
  const losses: MappingLoss[] = [];

  if (report.identity.user !== null) {
    losses.push({ path: "identity.user", reason: "unsupported" });
  }

  if (Object.keys(report.tags).length > 0) {
    losses.push({ path: "tags", reason: "unsupported" });
  }

  if (Object.keys(report.contexts).length > 0) {
    losses.push({ path: "contexts", reason: "unsupported" });
  }

  if (report.breadcrumbs.length > 0) {
    losses.push({ path: "breadcrumbs", reason: "unsupported" });
  }

  if (report.operation !== null) {
    losses.push({ path: "operation", reason: "unsupported" });
  }

  // Whatever is recorded is a non-fatal. There is no other level.
  if (report.level !== "error") {
    losses.push({ path: "level", reason: "unsupported" });
  }

  if (report.exception.aggregated.length > 0) {
    losses.push({ path: "exception.aggregated", reason: "unsupported" });
  }

  return losses;
};

/**
 * Records non-fatal errors in Firebase Crashlytics on React Native, through
 * the module the application injects. Crashlytics can attach nothing to one
 * report, and this adapter does not pretend otherwise: what a report carries
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
}: CrashlyticsAdapterOptions<TInstance>): ReporterAdapter<TInstance> => ({
  name: "crashlytics",
  open: () => {
    const instance = sdk.getCrashlytics();
    const mirror = createAmbientMirror(sdk, instance, ambient);

    return {
      native: instance,
      submit: (report, { currentGeneration }) => {
        if (report.kind === "message") {
          return { status: "skipped", reason: "unsupported-report-kind" };
        }

        // Crashlytics attaches its global user id natively. Where Flare wrote
        // that id, it is compared with the report's user.
        const reportUserId = report.identity.user?.id ?? null;

        if (ambient.user === true && reportUserId !== mirror.userId()) {
          return { status: "skipped", reason: "identity-mismatch" };
        }

        // Otherwise the account stands in for the id Flare cannot read: a
        // report whose user signed out since would land on the next one.
        const isStale = report.identity.generation !== currentGeneration();

        if (ambient.user !== true && reportUserId !== null && isStale) {
          return { status: "skipped", reason: "identity-mismatch" };
        }

        sdk.recordError(instance, new SanitizedError(report.exception));

        return {
          status: "submitted",
          evidence: "sdk-call-returned",
          losses: getReportLosses(report),
        };
      },
      ambient: mirror.ambient,
      dispose: mirror.clear,
    };
  },
});
