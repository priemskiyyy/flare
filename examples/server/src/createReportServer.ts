import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import type { z } from "zod";

import { createReportBackend } from "examples/shared/ledger/backend/createReportBackend";
import { applyBackendChange } from "src/applyBackendChange";
import { backendChange, readRequestBody, reportDelivery } from "src/requests";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, idempotency-key",
};

// How many accepted reports the server still recognizes as repeats. The
// oldest is forgotten first, so a long-running server stays bounded.
const REMEMBERED_ANSWERS = 1_000;

const send = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, {
    ...CORS_HEADERS,
    "content-type": "application/json",
  });
  response.end(JSON.stringify(body));
};

/** Your API over real HTTP, answering from the same backend the web examples run in the page. */
export const createReportServer = () => {
  const backend = createReportBackend({ latency: 0 });
  // Only accepted answers are kept, so a report that failed can be sent again.
  // Two copies in flight at once are both received.
  const answers = new Map<string, { id: string }>();

  const answerReport = async (
    { id, identity }: z.infer<typeof reportDelivery>,
    response: ServerResponse,
  ) => {
    const first = answers.get(id);

    if (first !== undefined) {
      send(response, 202, first);

      return;
    }

    const controller = new AbortController();

    // The client hung up, as the adapter does at its deadline.
    response.once("close", () => {
      if (response.writableEnded) {
        return;
      }

      controller.abort();
    });

    try {
      const answer = await backend.receive({
        reportId: id,
        account: identity.user?.id ?? null,
        signal: controller.signal,
      });

      answers.set(id, answer);

      // A Map keeps insertion order, so its first key is the oldest answer.
      const [oldest] = answers.keys();

      if (answers.size > REMEMBERED_ANSWERS && oldest !== undefined) {
        answers.delete(oldest);
      }

      send(response, 202, answer);
    } catch {
      send(response, 503, null);
    }
  };

  const server = createServer(async (request, response) => {
    try {
      const { pathname } = new URL(request.url ?? "/", "http://localhost");

      if (request.method === "OPTIONS") {
        response.writeHead(204, CORS_HEADERS);
        response.end();

        return;
      }

      if (request.method !== "POST") {
        send(response, 404, null);

        return;
      }

      if (pathname === "/api/reports") {
        await answerReport(
          reportDelivery.parse(await readRequestBody(request)),
          response,
        );

        return;
      }

      if (pathname === "/api/control") {
        applyBackendChange(
          backend,
          backendChange.parse(await readRequestBody(request)),
        );
        send(response, 200, backend.state.get());

        return;
      }

      send(response, 404, null);
    } catch {
      send(response, 400, null);
    }
  });

  const dispose = () =>
    new Promise<void>((resolve, reject) => {
      if (!server.listening) {
        resolve();

        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);

          return;
        }

        resolve();
      });
      server.closeAllConnections();
    });

  return { server, backend, dispose };
};
