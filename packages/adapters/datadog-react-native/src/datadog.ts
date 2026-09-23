import type {
  MappingLoss,
  ReporterAdapter,
  SanitizedReport,
} from "@priemskiyyy/flare";

import type { DatadogAdapterOptions } from "src/types/DatadogAdapterOptions";
import type { DdRumLike } from "src/types/DdRumLike";
import { CUSTOM_SOURCE, FLARE_ATTRIBUTE } from "src/utils/constants/attributes";

type ExceptionReport = Extract<SanitizedReport, { kind: "exception" }>;

const getReportAttributes = (report: ExceptionReport) => {
  const { exception } = report;

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
    causes: exception.causes.map(({ name, message, stack }) => ({
      name,
      message,
      stack,
    })),
  };

  if (report.operation !== null) {
    attributes.operation = report.operation;
  }

  if (exception.aggregated.length > 0) {
    attributes.aggregated = exception.aggregated.map(({ name, message }) => ({
      name,
      message,
    }));
  }

  return attributes;
};

// The SDK attaches the user it was given, which the adapter cannot read.
const getReportLosses = (report: ExceptionReport): MappingLoss[] => {
  if (report.identity.user === null) {
    return [];
  }

  return [{ path: "identity.user", reason: "unsupported" }];
};

/**
 * Sends exceptions to Datadog RUM on React Native through the `DdRum` the
 * application set up. Each report is one RUM error recorded at its capture
 * time, from its message and stack trace, with its causes and everything
 * else it carries under the `flare` attribute. Messages are skipped: RUM
 * records errors. Flare never initializes the SDK or sets its user.
 *
 * @example
 * ```ts
 * import { DdRum } from "@datadog/mobile-react-native";
 *
 * const flare = new Flare({ destinations: { datadog: datadog({ sdk: DdRum }) } });
 * ```
 */
export const datadog = <TSdk extends DdRumLike>({
  sdk,
}: DatadogAdapterOptions<TSdk>): ReporterAdapter<TSdk> => ({
  name: "datadog-react-native",
  open: () => ({
    native: sdk,
    submit: async (report, { currentGeneration }) => {
      if (report.kind === "message") {
        return { status: "skipped", reason: "unsupported-report-kind" };
      }

      // The SDK does not reveal its user, so the account stands in for it: a
      // report whose user signed out since would be filed under the next one.
      const { user, generation } = report.identity;

      if (user !== null && generation !== currentGeneration()) {
        return { status: "skipped", reason: "identity-mismatch" };
      }

      const { exception } = report;

      await sdk.addError(
        exception.message,
        CUSTOM_SOURCE,
        // The header names the error, as the SDK's own stack traces do.
        exception.stack ?? `${exception.name}: ${exception.message}`,
        { [FLARE_ATTRIBUTE]: getReportAttributes(report) },
        report.timestamp,
      );

      return {
        status: "submitted",
        evidence: "sdk-call-returned",
        losses: getReportLosses(report),
      };
    },
  }),
});
