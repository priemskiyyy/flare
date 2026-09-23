import { createServer } from "node:http";
import type { IncomingHttpHeaders, ServerResponse } from "node:http";

import type { ReceivedRequest } from "src/types/ReceivedRequest";

type Answer = (request: ReceivedRequest, response: ServerResponse) => void;

// The SDKs that run in jsdom send cross-origin requests with custom headers,
// so every answer allows them.
const allowCrossOrigin = (
  headers: IncomingHttpHeaders,
  response: ServerResponse,
) => {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  response.setHeader(
    "access-control-allow-headers",
    headers["access-control-request-headers"] ?? "*",
  );
};

/**
 * An HTTP endpoint on a random loopback port that keeps every request it
 * receives, and every one whose client hung up before it was answered.
 */
export const startReceiver = async (answer: Answer) => {
  const requests: ReceivedRequest[] = [];
  const abandoned: ReceivedRequest[] = [];

  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];

    allowCrossOrigin(request.headers, response);

    if (request.method === "OPTIONS") {
      response.writeHead(204).end();

      return;
    }

    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const received = {
        method: request.method ?? "",
        path: request.url ?? "",
        headers: request.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      };

      requests.push(received);
      response.once("close", () => {
        if (response.writableEnded) {
          return;
        }

        abandoned.push(received);
      });
      answer(received, response);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Expected the receiver to bind a TCP port.");
  }

  const close = () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });

  return {
    origin: `http://127.0.0.1:${address.port}`,
    requests,
    abandoned,
    close,
  };
};
