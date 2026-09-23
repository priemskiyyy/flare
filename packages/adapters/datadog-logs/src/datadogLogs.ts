import { FlareError, SanitizedError } from "@priemskiyyy/flare";
import type {
  MappingLoss,
  ReporterAdapter,
  SanitizedReport,
} from "@priemskiyyy/flare";

import type { DatadogLogsAdapterOptions } from "src/types/DatadogLogsAdapterOptions";
import type { DatadogLogsLike } from "src/types/DatadogLogsLike";
import { assertUnreachable } from "src/utils/assertUnreachable";
import { FLARE_ATTRIBUTE, PROTOTYPE_KEY } from "src/utils/constants/attributes";
import { STATUSES } from "src/utils/constants/statuses";

const getLogMessage = (report: SanitizedReport) => {
  if (report.kind === "message") {
    return report.message;
  }

  if (report.kind === "exception") {
    if (report.exception.message === "") {
      return report.exception.name;
    }

    return report.exception.message;
  }

  return assertUnreachable(report);
};

const getLogError = (report: SanitizedReport) => {
  if (report.kind === "message") {
    return undefined;
  }

  return new SanitizedError(report.exception);
};

const getReportAttributes = (report: SanitizedReport) => {
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

  if (report.kind === "exception" && report.exception.aggregated.length > 0) {
    attributes.aggregated = report.exception.aggregated.map(
      ({ name, message }) => ({ name, message }),
    );
  }

  return attributes;
};

const getReportLosses = (report: SanitizedReport): MappingLoss[] => {
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
 * Sends reports to Datadog Logs through the `datadogLogs` the application
 * initialized, messages included. Each report is one log with its own
 * status and error, and everything else it carries under the `flare`
 * attribute. Datadog attaches its current user to every log, so a report is
 * sent only while that user is the report's own. Flare never initializes the
 * SDK or sets its user.
 *
 * @example
 * ```ts
 * import { datadogLogs as browserLogs } from "@datadog/browser-logs";
 *
 * browserLogs.init({ clientToken });
 * const flare = new Flare({ destinations: { logs: datadogLogs({ sdk: browserLogs }) } });
 * ```
 */
export const datadogLogs = <TSdk extends DatadogLogsLike>({
  sdk,
}: DatadogLogsAdapterOptions<TSdk>): ReporterAdapter<TSdk> => ({
  name: "datadog-logs",
  open: () => {
    // Before `init`, the SDK keeps logs in a buffer of its own, sent only if
    // `init` ever runs.
    if (sdk.getInitConfiguration() === undefined) {
      throw new FlareError({
        code: "NOT_INITIALIZED",
        message:
          "Datadog Logs is not initialized. Call datadogLogs.init before flare.start().",
      });
    }

    return {
      native: sdk,
      submit: (report) => {
        const { user } = report.identity;

        if (user !== null && user.id !== sdk.getUser().id) {
          return { status: "skipped", reason: "identity-mismatch" };
        }

        sdk.logger.log(
          getLogMessage(report),
          { [FLARE_ATTRIBUTE]: getReportAttributes(report) },
          STATUSES[report.level],
          getLogError(report),
        );

        return {
          status: "submitted",
          evidence: "sdk-call-returned",
          losses: getReportLosses(report),
        };
      },
    };
  },
});
