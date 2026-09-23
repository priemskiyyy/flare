import { FlareError, SanitizedError } from "@priemskiyyy/flare";
import type {
  MappingLoss,
  ReporterAdapter,
  SanitizedReport,
} from "@priemskiyyy/flare";

import type { PostHogAdapterOptions } from "src/types/PostHogAdapterOptions";
import type { PostHogLike } from "src/types/PostHogLike";
import {
  AGGREGATED_PROPERTY,
  OPERATION_PROPERTY,
  REPORT_ID_PROPERTY,
  RESERVED_PROPERTIES,
  STEP_FIELDS,
} from "src/utils/constants/properties";

type ExceptionReport = Extract<SanitizedReport, { kind: "exception" }>;

const isReservedProperty = (name: string) => {
  if (name.startsWith("$")) {
    return true;
  }

  return RESERVED_PROPERTIES.includes(name);
};

const getExceptionProperties = (report: ExceptionReport) => {
  const properties: Record<string, unknown> = {};

  for (const [name, context] of Object.entries(report.contexts)) {
    if (isReservedProperty(name)) {
      continue;
    }

    properties[name] = context;
  }

  // Written after the contexts, so a tag takes a name it shares with one.
  for (const [key, value] of Object.entries(report.tags)) {
    if (isReservedProperty(key)) {
      continue;
    }

    properties[key] = value;
  }

  properties.$exception_level = report.level;
  // Written even when empty: PostHog would otherwise attach the steps it
  // buffered for whoever is using the application now.
  properties.$exception_steps = report.breadcrumbs.map(
    ({ name, data, timestamp }) => ({
      ...data,
      $message: name,
      $timestamp: new Date(timestamp).toISOString(),
    }),
  );
  properties[REPORT_ID_PROPERTY] = report.id;

  if (report.operation !== null) {
    properties[OPERATION_PROPERTY] = report.operation;
  }

  if (report.exception.aggregated.length > 0) {
    properties[AGGREGATED_PROPERTY] = report.exception.aggregated.map(
      ({ name, message }) => ({ name, message }),
    );
  }

  return properties;
};

const getReportLosses = (report: ExceptionReport): MappingLoss[] => {
  const losses: MappingLoss[] = [];

  for (const key of Object.keys(report.tags)) {
    if (isReservedProperty(key)) {
      losses.push({ path: `tags.${key}`, reason: "unsupported" });
    }
  }

  for (const name of Object.keys(report.contexts)) {
    if (isReservedProperty(name) || Object.hasOwn(report.tags, name)) {
      losses.push({ path: `contexts.${name}`, reason: "unsupported" });
    }
  }

  for (const [index, { data }] of report.breadcrumbs.entries()) {
    if (data === null) {
      continue;
    }

    for (const field of STEP_FIELDS) {
      if (Object.hasOwn(data, field)) {
        losses.push({
          path: `breadcrumbs.${index}.data.${field}`,
          reason: "unsupported",
        });
      }
    }
  }

  return losses;
};

/**
 * Sends exceptions to PostHog error tracking through the posthog-js instance
 * the application initialized. Each report is one `$exception` event whose
 * properties are its own, merged over PostHog's on that event only. PostHog
 * files every event under the person it identifies, so a report is sent only
 * while that person is the report's user. Messages are skipped: PostHog
 * tracks exceptions. Flare never initializes PostHog, identifies anyone or
 * resets anything.
 *
 * @example
 * ```ts
 * import posthogJs from "posthog-js";
 *
 * posthogJs.init(token);
 * const flare = new Flare({ destinations: { posthog: posthog({ sdk: posthogJs }) } });
 * ```
 */
export const posthog = <TSdk extends PostHogLike>({
  sdk,
}: PostHogAdapterOptions<TSdk>): ReporterAdapter<TSdk> => ({
  name: "posthog",
  open: () => {
    // Before `posthog.init`, every capture is silently ignored.
    if (!sdk.__loaded) {
      throw new FlareError({
        code: "NOT_INITIALIZED",
        message:
          "PostHog is not initialized. Call posthog.init before flare.start().",
      });
    }

    if (sdk.exceptions === undefined) {
      throw new FlareError({
        code: "UNSUPPORTED",
        message:
          "PostHog was initialized without error tracking, so it cannot capture exceptions.",
      });
    }

    return {
      native: sdk,
      submit: (report) => {
        if (report.kind === "message") {
          return { status: "skipped", reason: "unsupported-report-kind" };
        }

        const { user } = report.identity;

        if (user !== null && user.id !== sdk.get_distinct_id()) {
          return { status: "skipped", reason: "identity-mismatch" };
        }

        const result = sdk.captureException(
          new SanitizedError(report.exception),
          getExceptionProperties(report),
        );

        // Opt-out, bot detection, rate limits, suppression rules and
        // `before_send` all answer undefined.
        if (result === undefined) {
          return { status: "dropped", reason: "provider-filtered" };
        }

        return {
          status: "submitted",
          evidence: "sdk-call-returned",
          event: { id: result.uuid },
          losses: getReportLosses(report),
        };
      },
    };
  },
});
