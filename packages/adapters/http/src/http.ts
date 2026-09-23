import type { ReporterAdapter } from "@priemskiyyy/flare";

import type { HttpAdapterOptions } from "src/types/HttpAdapterOptions";

/**
 * Sends each report to your own backend through your own client. A request
 * that resolves is `backend-acknowledged` evidence, one that throws is a
 * failure, and a report is sent once: there is no retry and no queue. A
 * report whose user has signed out since it was captured is never sent,
 * because your client authenticates as whoever is signed in now.
 *
 * @example
 * ```ts
 * const flare = new Flare({
 *   destinations: {
 *     backend: http({
 *       request: async ({ report, signal }) => {
 *         const response = await fetch("/api/error-reports", {
 *           method: "POST",
 *           headers: { "content-type": "application/json", "idempotency-key": report.id },
 *           body: JSON.stringify(report),
 *           signal,
 *         });
 *         if (!response.ok) {
 *           throw new Error(`The backend answered ${response.status}.`);
 *         }
 *       },
 *     }),
 *   },
 * });
 * ```
 */
export const http = ({
  request,
}: HttpAdapterOptions): ReporterAdapter<HttpAdapterOptions["request"]> => ({
  name: "http",
  open: () => ({
    native: request,
    submit: async (report, { signal, currentGeneration }) => {
      const isStale = report.identity.generation !== currentGeneration();

      if (report.identity.user !== null && isStale) {
        return { status: "skipped", reason: "auth-subject-mismatch" };
      }

      const acknowledgement = await request({ report, signal });

      if (typeof acknowledgement !== "object") {
        return { status: "submitted", evidence: "backend-acknowledged" };
      }

      return {
        status: "submitted",
        evidence: "backend-acknowledged",
        event: { id: acknowledgement.id },
      };
    },
  }),
});
