import { createReporterAdapter } from "@priemskiyyy/flare";
import type {
  ReporterCapabilities,
  SanitizedReport,
  SubmissionContext,
  SubmissionResult,
} from "@priemskiyyy/flare";

import type { FetchLike } from "src/types/FetchLike";
import type { HttpReporterHandle } from "src/types/HttpReporterHandle";
import type { HttpReporterOptions } from "src/types/HttpReporterOptions";

const CAPABILITIES: ReporterCapabilities = {
  eventLocal: { user: true, tags: true, contexts: true, breadcrumbs: true },
  messages: true,
  evidence: "backend-acknowledged",
  // Every submission awaits its own response, so the core's drain is the whole flush.
  flush: "none",
  queue: "none",
  automaticCapture: "none",
  instance: "instance",
  filtering: "none",
};

const SUBJECT_MISMATCH: SubmissionResult = {
  status: "skipped",
  reason: "auth-subject-mismatch",
};

// Normalize each source before merging so differently cased names still override.
const normalizeHeaders = (headers: Record<string, string> = {}) =>
  Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );

const readEvent = async (response: { json: () => Promise<unknown> }) => {
  try {
    const body = await response.json();

    if (typeof body !== "object" || body === null || !("id" in body)) {
      return null;
    }

    const { id } = body;

    return typeof id === "string" ? { id } : null;
  } catch {
    // An acknowledgement needs no body, and a body need not be JSON.
    return null;
  }
};

/**
 * Posts each report to your own backend as JSON. The report id travels as the
 * `Idempotency-Key`, a `2xx` answer is `backend-acknowledged` evidence, and a
 * report is sent once: there is no retry, no queue and no offline storage.
 *
 * @example
 * ```ts
 * const flare = new Flare({
 *   destinations: { backend: http({ endpoint: "/api/error-reports" }) },
 * });
 * ```
 */
export const http = ({
  endpoint,
  headers,
  authorize,
  fetch: configured,
}: HttpReporterOptions) => {
  // Read when a report is sent, so a polyfill installed later is honoured.
  const resolveFetch = (): FetchLike | undefined =>
    configured ?? globalThis.fetch;

  const submit = async (
    report: SanitizedReport,
    context: SubmissionContext,
  ): Promise<SubmissionResult> => {
    if (context.signal.aborted) {
      return { status: "indeterminate", reason: "ambiguous" };
    }

    const send = resolveFetch();

    if (typeof send !== "function") {
      return {
        status: "failed",
        error: new Error(
          `The http reporter could not POST ${endpoint}: this environment has no fetch.`,
        ),
      };
    }

    const isCurrentAccount = () =>
      context.currentGeneration() === report.identity.generation;

    const shared = normalizeHeaders(
      typeof headers === "function" ? await headers() : headers,
    );

    if (context.signal.aborted) {
      return { status: "indeterminate", reason: "ambiguous" };
    }

    let credentials: Record<string, string> = {};

    if (typeof authorize === "function") {
      if (!isCurrentAccount()) {
        return SUBJECT_MISMATCH;
      }

      credentials = normalizeHeaders(
        await authorize({ user: report.identity.user }),
      );

      if (context.signal.aborted) {
        return { status: "indeterminate", reason: "ambiguous" };
      }

      // The account can change while its credentials are being fetched. Nothing
      // asynchronous may sit between this check and the request.
      if (!isCurrentAccount()) {
        return SUBJECT_MISMATCH;
      }
    }

    const response = await send(endpoint, {
      method: "POST",
      headers: {
        ...shared,
        ...credentials,
        "content-type": "application/json",
        "idempotency-key": report.id,
      },
      body: JSON.stringify(report),
      signal: context.signal,
    });

    if (!response.ok) {
      return {
        status: "failed",
        error: new Error(
          `The http reporter could not POST ${endpoint}: the server answered ${response.status}.`,
        ),
      };
    }

    return {
      status: "submitted",
      evidence: "backend-acknowledged",
      event: await readEvent(response),
    };
  };

  return createReporterAdapter<HttpReporterHandle>({
    name: "http",
    capabilities: CAPABILITIES,
    available: () => {
      if (typeof resolveFetch() === "function") {
        return { available: true };
      }

      return {
        available: false,
        reason:
          "No fetch is available. Pass one through the http reporter's fetch option.",
      };
    },
    open: () => ({ native: { endpoint }, submit }),
  });
};
