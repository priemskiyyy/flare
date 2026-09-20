import { createReporterAdapter, rebuildError } from "@priemskiyyy/flare";
import type { ReporterCapabilities } from "@priemskiyyy/flare";

import type { SentryLike } from "src/types/SentryLike";
import type { SentryReporterOptions } from "src/types/SentryReporterOptions";
import { applyReportToEvent } from "src/utils/applyReportToEvent";
import { assertUnreachable } from "src/utils/assertUnreachable";
import { createAmbientMirror } from "src/utils/createAmbientMirror";
import { getReportLosses } from "src/utils/getReportLosses";

/** The mapping shared by every platform. Only the capabilities differ between them. */
export const createSentryReporter = <TSdk extends SentryLike>(
  { sdk, ambient = {}, ...lifecycle }: SentryReporterOptions<TSdk>,
  platform: Pick<ReporterCapabilities, "flush" | "queue">,
) =>
  createReporterAdapter<TSdk>({
    name: "sentry",
    capabilities: {
      eventLocal: { user: true, tags: true, contexts: true, breadcrumbs: true },
      messages: true,
      evidence: "sdk-call-returned",
      flush: platform.flush,
      queue: platform.queue,
      automaticCapture: "provider-owned",
      instance: "singleton",
      // Sampling and beforeSend may still discard an event after capture returns.
      filtering: "provider-hooks",
    },
    singleton: sdk,
    open: (_context, lifetime) => {
      if (lifecycle.ownership === "owned") {
        lifecycle.init();
      }

      if (sdk.getClient() === undefined) {
        throw new Error(
          'Sentry is not initialized. Call Sentry.init before flare.start(), or pass ownership: "owned" with an init function.',
        );
      }

      const mirror = createAmbientMirror(sdk, ambient);
      lifetime.add(mirror.clear);

      return {
        native: sdk,
        submit: (report) => {
          let id = "";
          // The fork is current only while this callback runs, so nothing set
          // here can reach another report or an event Sentry captures itself.
          sdk.withScope((scope) => {
            const mirrored = mirror.mirrored();
            scope.addEventProcessor((event) =>
              applyReportToEvent(event, report, mirrored),
            );
            if (report.kind === "exception") {
              id = sdk.captureException(rebuildError(report.exception));
              return;
            }
            if (report.kind === "message") {
              id = sdk.captureMessage(report.message);
              return;
            }
            assertUnreachable(report);
          });

          return {
            status: "submitted",
            // An event id is handed out before sampling and beforeSend run,
            // so it proves the call returned and nothing more.
            evidence: "sdk-call-returned",
            event: typeof id === "string" && id !== "" ? { id } : null,
            losses: getReportLosses(report),
          };
        },
        flush: async ({ timeoutMs }) => {
          const flushed = await sdk.flush(timeoutMs);
          return flushed ? { status: "flushed" } : { status: "timeout" };
        },
        ...(mirror.context === undefined ? {} : { ambient: mirror.context }),
        // Only an owned SDK has anything to await, so a borrowed one is
        // released synchronously, mirrored state included.
        dispose: () => {
          if (lifecycle.ownership !== "owned") {
            return;
          }
          return Promise.resolve(sdk.close()).then(() => {});
        },
      };
    },
  });
