import type {
  ReporterAdapter,
  ReporterSession,
  SanitizedReport,
} from "@priemskiyyy/flare";

import type { OpenTelemetryAdapterOptions } from "src/types/OpenTelemetryAdapterOptions";
import type { OpenTelemetryLoggerLike } from "src/types/OpenTelemetryLoggerLike";
import { assertUnreachable } from "src/utils/assertUnreachable";
import { SEVERITIES } from "src/utils/constants/severities";

const getLogBody = (report: SanitizedReport) => {
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

const getLogAttributes = (report: SanitizedReport) => {
  const attributes: Record<string, unknown> = {
    "flare.report_id": report.id,
    "flare.tags": report.tags,
    "flare.contexts": report.contexts,
    "flare.breadcrumbs": report.breadcrumbs.map(
      ({ name, data, timestamp }) => ({
        name,
        data,
        timestamp: new Date(timestamp).toISOString(),
      }),
    ),
  };

  if (report.operation !== null) {
    attributes["flare.operation"] = report.operation;
  }

  const { user } = report.identity;

  if (user !== null) {
    attributes["user.id"] = user.id;
  }

  if (user?.email !== undefined) {
    attributes["user.email"] = user.email;
  }

  // The semantic conventions call a display name the user's full name.
  if (user?.name !== undefined) {
    attributes["user.full_name"] = user.name;
  }

  if (report.kind === "message") {
    return attributes;
  }

  const { exception } = report;

  attributes["exception.type"] = exception.name;
  attributes["exception.message"] = exception.message;

  if (exception.stack !== null) {
    attributes["exception.stacktrace"] = exception.stack;
  }

  if (exception.causes.length > 0) {
    attributes["flare.causes"] = exception.causes.map(
      ({ name, message, stack }) => ({ name, message, stack }),
    );
  }

  if (exception.aggregated.length > 0) {
    attributes["flare.aggregated"] = exception.aggregated.map(
      ({ name, message }) => ({ name, message }),
    );
  }

  return attributes;
};

/**
 * Sends reports to OpenTelemetry as log records, through the logger the
 * application's provider made, and so to any OTLP backend. A log record
 * carries everything itself: each report is one record with its own
 * severity, user, exception and attributes, and nothing global is written.
 *
 * @example
 * ```ts
 * import { logs } from "@opentelemetry/api-logs";
 *
 * const flare = new Flare({
 *   destinations: { otel: opentelemetry({ logger: logs.getLogger("app") }) },
 * });
 * ```
 */
export const opentelemetry = <TLogger extends OpenTelemetryLoggerLike>({
  logger,
  forceFlush,
}: OpenTelemetryAdapterOptions<TLogger>): ReporterAdapter<TLogger> => ({
  name: "opentelemetry",
  open: () => {
    const session: ReporterSession<TLogger> = {
      native: logger,
      submit: (report) => {
        logger.emit({
          timestamp: new Date(report.timestamp),
          ...SEVERITIES[report.level],
          body: getLogBody(report),
          attributes: getLogAttributes(report),
        });

        return { status: "submitted", evidence: "sdk-call-returned" };
      },
    };

    if (forceFlush === undefined) {
      return session;
    }

    return {
      ...session,
      flush: async () => {
        await forceFlush();

        return { status: "flushed" };
      },
    };
  },
});
