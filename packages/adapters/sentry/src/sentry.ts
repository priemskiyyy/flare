import { FlareError, SanitizedError } from "@priemskiyyy/flare";
import type {
  MappingLoss,
  ReporterAdapter,
  SanitizedReport,
} from "@priemskiyyy/flare";

import type { SentryAdapterOptions } from "src/types/SentryAdapterOptions";
import type { SentryLike } from "src/types/SentryLike";
import { applyReportToEvent } from "src/utils/applyReportToEvent";
import { assertUnreachable } from "src/utils/assertUnreachable";
import { AGGREGATED_CONTEXT, REPORT_ID_TAG } from "src/utils/constants/event";
import {
  MAX_TAG_KEY_LENGTH,
  MAX_TAG_VALUE_LENGTH,
} from "src/utils/constants/limits";
import { createAmbientMirror } from "src/utils/createAmbientMirror";

const captureReport = (sdk: SentryLike, report: SanitizedReport) => {
  if (report.kind === "exception") {
    return sdk.captureException(new SanitizedError(report.exception));
  }

  if (report.kind === "message") {
    return sdk.captureMessage(report.message);
  }

  return assertUnreachable(report);
};

const getReportLosses = (report: SanitizedReport): MappingLoss[] => {
  const losses: MappingLoss[] = [];

  for (const [key, value] of Object.entries(report.tags)) {
    if (key === REPORT_ID_TAG) {
      losses.push({ path: `tags.${key}`, reason: "unsupported" });
      continue;
    }

    const isCut =
      key.length > MAX_TAG_KEY_LENGTH ||
      String(value).length > MAX_TAG_VALUE_LENGTH;

    if (isCut) {
      losses.push({ path: `tags.${key}`, reason: "truncated" });
    }
  }

  const hasAggregated =
    report.kind === "exception" && report.exception.aggregated.length > 0;

  if (hasAggregated && Object.hasOwn(report.contexts, AGGREGATED_CONTEXT)) {
    losses.push({
      path: `contexts.${AGGREGATED_CONTEXT}`,
      reason: "unsupported",
    });
  }

  return losses;
};

/**
 * Sends reports to Sentry through the SDK the application initialized, in the
 * browser and on React Native. Each report is mapped after scope composition,
 * so its user, tags, contexts and breadcrumbs never change Sentry's shared
 * scopes. Flare never initializes or closes the SDK.
 *
 * @example
 * ```ts
 * import * as Sentry from "@sentry/browser";
 *
 * Sentry.init({ dsn });
 * const flare = new Flare({ destinations: { sentry: sentry({ sdk: Sentry }) } });
 * ```
 */
export const sentry = <TSdk extends SentryLike>({
  sdk,
  ambient = {},
}: SentryAdapterOptions<TSdk>): ReporterAdapter<TSdk> => ({
  name: "sentry",
  open: () => {
    // Before `Sentry.init`, a capture still returns an event id and sends nothing.
    if (sdk.getClient() === undefined) {
      throw new FlareError({
        code: "NOT_INITIALIZED",
        message:
          "Sentry is not initialized. Call Sentry.init before flare.start().",
      });
    }

    const mirror = createAmbientMirror(sdk, ambient);

    return {
      native: sdk,
      submit: (report) => {
        // The fork is current only inside the callback, so nothing set here
        // reaches another event.
        const id = sdk.withScope((scope) => {
          const mirrored = mirror.mirrored();

          scope.addEventProcessor((event) =>
            applyReportToEvent(event, report, mirrored),
          );

          return captureReport(sdk, report);
        });

        // React Native logs what the callback threw and answers undefined, so
        // the report was not captured and its error is already gone.
        if (id === undefined) {
          return {
            status: "failed",
            error: new FlareError({
              code: "SUBMISSION_FAILED",
              message:
                "Sentry React Native swallowed an error while capturing the report.",
            }),
          };
        }

        return {
          status: "submitted",
          // An event id is handed out before sampling and beforeSend run,
          // so it proves the call returned and nothing more.
          evidence: "sdk-call-returned",
          event: { id },
          losses: getReportLosses(report),
        };
      },
      flush: async ({ timeout }) => {
        const flushed = await sdk.flush(timeout);

        if (!flushed) {
          return { status: "timeout" };
        }

        return { status: "flushed" };
      },
      ambient: mirror.ambient,
      dispose: mirror.clear,
    };
  },
});
