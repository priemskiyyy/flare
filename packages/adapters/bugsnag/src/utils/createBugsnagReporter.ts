import { createReporterAdapter, rebuildError } from "@priemskiyyy/flare";
import type {
  ReporterCapabilities,
  SanitizedReport,
  SubmissionResult,
} from "@priemskiyyy/flare";

import type { BugsnagLike } from "src/types/BugsnagLike";
import type { BugsnagReporterOptions } from "src/types/BugsnagReporterOptions";
import { applyReportToEvent } from "src/utils/applyReportToEvent";
import { assertUnreachable } from "src/utils/assertUnreachable";
import { createAmbientMirror } from "src/utils/createAmbientMirror";
import { getReportLosses } from "src/utils/getReportLosses";

// Bugsnag has no message events, so an opted-in message travels as an error with this name.
const toError = (report: SanitizedReport) => {
  if (report.kind === "exception") {
    return rebuildError(report.exception);
  }
  if (report.kind !== "message") {
    return assertUnreachable(report);
  }
  return rebuildError({
    origin: "primitive",
    name: "Message",
    message: report.message,
    stack: null,
    causes: [],
    aggregated: [],
  });
};

/** The mapping shared by every platform. Only the queue differs between them. */
export const createBugsnagReporter = <TSdk extends BugsnagLike>(
  {
    sdk,
    Breadcrumb,
    messages = "skip",
    ambient = {},
    ...lifecycle
  }: BugsnagReporterOptions<TSdk>,
  platform: Pick<ReporterCapabilities, "queue">,
) =>
  createReporterAdapter<TSdk>({
    name: "bugsnag",
    capabilities: {
      eventLocal: {
        user: true,
        tags: true,
        contexts: true,
        breadcrumbs: Breadcrumb !== undefined,
      },
      messages: messages === "as-error",
      // The callback fires for a delivered event, for one queued for later,
      // and for one an onError callback discarded. It cannot tell them apart.
      evidence: "sdk-callback-completed",
      flush: "none",
      queue: platform.queue,
      automaticCapture: "provider-owned",
      instance: "singleton",
      filtering: "provider-hooks",
    },
    singleton: sdk,
    open: (_context, lifetime) => {
      if (lifecycle.ownership === "owned") {
        lifecycle.start();
      }

      if (!sdk.isStarted()) {
        throw new Error(
          'Bugsnag is not started. Call Bugsnag.start before flare.start(), or pass ownership: "owned" with a start function.',
        );
      }

      const mirror = createAmbientMirror(sdk, ambient);
      lifetime.add(mirror.clear);

      return {
        native: sdk,
        submit: (report) => {
          if (report.kind === "message" && messages !== "as-error") {
            return { status: "skipped", reason: "unsupported-report-kind" };
          }

          const losses = getReportLosses(report, {
            carriesBreadcrumbs: Breadcrumb !== undefined,
          });
          // The SDK copies ambient metadata now; earlier application hooks
          // may delay our callback until the mirror belongs to another user.
          const mirroredSections = mirror.sections();
          return new Promise<SubmissionResult>((resolve) => {
            sdk.notify(
              toError(report),
              (event) => {
                try {
                  applyReportToEvent(event, report, {
                    Breadcrumb,
                    mirroredSections,
                  });
                } catch (error) {
                  // Bugsnag continues after a thrown hook. Refuse the event
                  // explicitly so a partially mapped report is never sent.
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
                  evidence: "sdk-callback-completed",
                  losses,
                });
              },
            );
          });
        },
        ...(mirror.context === undefined ? {} : { ambient: mirror.context }),
      };
    },
  });
