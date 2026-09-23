import { FlareError, SanitizedError } from "@priemskiyyy/flare";
import type {
  MappingLoss,
  ReporterAdapter,
  SanitizedReport,
  SubmissionResult,
} from "@priemskiyyy/flare";

import type { BugsnagAdapterOptions } from "src/types/BugsnagAdapterOptions";
import type { BugsnagLike } from "src/types/BugsnagLike";
import { applyReportToEvent } from "src/utils/applyReportToEvent";
import { assertUnreachable } from "src/utils/assertUnreachable";
import { RESERVED_SECTIONS } from "src/utils/constants/metadata";
import { createAmbientMirror } from "src/utils/createAmbientMirror";

const getReportError = (report: SanitizedReport) => {
  if (report.kind === "exception") {
    return new SanitizedError(report.exception);
  }

  // Bugsnag has no message events, so a message travels as an error.
  if (report.kind === "message") {
    return new SanitizedError({
      name: "Message",
      message: report.message,
      stack: null,
    });
  }

  return assertUnreachable(report);
};

const getReportLosses = (report: SanitizedReport): MappingLoss[] => {
  const losses: MappingLoss[] = [];

  if (report.kind === "message") {
    losses.push({ path: "kind", reason: "unsupported" });
  }

  if (report.level === "fatal") {
    losses.push({ path: "level", reason: "unsupported" });
  }

  for (const name of RESERVED_SECTIONS) {
    if (Object.hasOwn(report.contexts, name)) {
      losses.push({ path: `contexts.${name}`, reason: "unsupported" });
    }
  }

  return losses;
};

/**
 * Sends reports to Bugsnag through the SDK the application started, in the
 * browser and on React Native. Each report is written inside the `onError`
 * callback of its own `notify` call, onto an event Bugsnag built from a copy
 * of the client, so its user, metadata and breadcrumbs never reach the
 * client. Flare never starts the SDK.
 *
 * @example
 * ```ts
 * import Bugsnag, { Breadcrumb } from "@bugsnag/js";
 *
 * Bugsnag.start({ apiKey });
 * const flare = new Flare({ destinations: { bugsnag: bugsnag({ sdk: Bugsnag, Breadcrumb }) } });
 * ```
 */
export const bugsnag = <TSdk extends BugsnagLike>({
  sdk,
  Breadcrumb,
  messages = "skip",
  ambient = {},
}: BugsnagAdapterOptions<TSdk>): ReporterAdapter<TSdk> => ({
  name: "bugsnag",
  open: () => {
    // Before `Bugsnag.start`, `notify` only logs and never calls back.
    if (!sdk.isStarted()) {
      throw new FlareError({
        code: "NOT_INITIALIZED",
        message:
          "Bugsnag is not started. Call Bugsnag.start before flare.start().",
      });
    }

    const mirror = createAmbientMirror(sdk, ambient);

    return {
      native: sdk,
      submit: (report) => {
        if (report.kind === "message" && messages === "skip") {
          return { status: "skipped", reason: "unsupported-report-kind" };
        }

        const losses = getReportLosses(report);
        // Read now: the SDK copies the client now, but earlier onError hooks
        // may delay ours until the mirror holds another account.
        const mirroredSections = mirror.sections();

        return new Promise<SubmissionResult>((resolve) => {
          sdk.notify(
            getReportError(report),
            (event) => {
              try {
                applyReportToEvent(event, report, {
                  Breadcrumb,
                  mirroredSections,
                });
              } catch (error) {
                // Bugsnag sends the event after a thrown hook, so a partly
                // mapped report is refused explicitly.
                resolve({ status: "failed", error });

                return false;
              }
            },
            (failure) => {
              if (failure !== null && failure !== undefined) {
                resolve({ status: "failed", error: failure });

                return;
              }

              resolve({
                status: "submitted",
                // Bugsnag also calls back for an event it queued, or one an
                // onError hook discarded.
                evidence: "sdk-callback-completed",
                losses,
              });
            },
          );
        });
      },
      ambient: mirror.ambient,
      dispose: mirror.clear,
    };
  },
});
