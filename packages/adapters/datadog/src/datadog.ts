import { FlareError, SanitizedError } from "@priemskiyyy/flare";
import type {
  MappingLoss,
  ReporterAdapter,
  SanitizedReport,
} from "@priemskiyyy/flare";

import type { DatadogAdapterOptions } from "src/types/DatadogAdapterOptions";
import type { DatadogRumLike } from "src/types/DatadogRumLike";
import { FLARE_ATTRIBUTE, PROTOTYPE_KEY } from "src/utils/constants/attributes";

type ExceptionReport = Extract<SanitizedReport, { kind: "exception" }>;

const getReportAttributes = (report: ExceptionReport) => {
  const attributes: Record<string, unknown> = {
    report_id: report.id,
    level: report.level,
    tags: report.tags,
    contexts: report.contexts,
    breadcrumbs: report.breadcrumbs.map(({ name, data, timestamp }) => ({
      name,
      data,
      timestamp: new Date(timestamp).toISOString(),
    })),
  };

  if (report.operation !== null) {
    attributes.operation = report.operation;
  }

  if (report.exception.aggregated.length > 0) {
    attributes.aggregated = report.exception.aggregated.map(
      ({ name, message }) => ({ name, message }),
    );
  }

  return attributes;
};

const getReportLosses = (report: ExceptionReport): MappingLoss[] => {
  const losses: MappingLoss[] = [];

  if (Object.hasOwn(report.tags, PROTOTYPE_KEY)) {
    losses.push({ path: `tags.${PROTOTYPE_KEY}`, reason: "unsupported" });
  }

  if (Object.hasOwn(report.contexts, PROTOTYPE_KEY)) {
    losses.push({ path: `contexts.${PROTOTYPE_KEY}`, reason: "unsupported" });
  }

  return losses;
};

/**
 * Sends exceptions to Datadog RUM through the `datadogRum` the application
 * initialized. Each report is one RUM error: the rebuilt error with its
 * causes, and everything else the report carries under the `flare`
 * attribute of that error's own context. RUM attaches its current user to
 * every event, so a report is sent only while that user is the report's
 * own. Messages are skipped: RUM records errors. Flare never initializes RUM
 * or sets its user.
 *
 * @example
 * ```ts
 * import { datadogRum } from "@datadog/browser-rum";
 *
 * datadogRum.init({ applicationId, clientToken });
 * const flare = new Flare({ destinations: { datadog: datadog({ sdk: datadogRum }) } });
 * ```
 */
export const datadog = <TSdk extends DatadogRumLike>({
  sdk,
}: DatadogAdapterOptions<TSdk>): ReporterAdapter<TSdk> => ({
  name: "datadog",
  open: () => {
    // Before `init`, RUM keeps errors in a buffer of its own, sent only if
    // `init` ever runs.
    if (sdk.getInitConfiguration() === undefined) {
      throw new FlareError({
        code: "NOT_INITIALIZED",
        message:
          "Datadog RUM is not initialized. Call datadogRum.init before flare.start().",
      });
    }

    return {
      native: sdk,
      submit: (report) => {
        if (report.kind === "message") {
          return { status: "skipped", reason: "unsupported-report-kind" };
        }

        const { user } = report.identity;

        if (user !== null && user.id !== sdk.getUser().id) {
          return { status: "skipped", reason: "identity-mismatch" };
        }

        sdk.addError(new SanitizedError(report.exception), {
          [FLARE_ATTRIBUTE]: getReportAttributes(report),
        });

        return {
          status: "submitted",
          evidence: "sdk-call-returned",
          losses: getReportLosses(report),
        };
      },
    };
  },
});
