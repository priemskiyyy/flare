import type { IncomingMessage } from "node:http";
import { z } from "zod";

// Flare bounds a report at 200 000 characters, which UTF-8 can spend up to
// 800 KB on.
const MAX_BODY_BYTES = 1_048_576;

/** What the API reads of a report: its id, the idempotency key, and whose it is. */
export const reportDelivery = z.object({
  id: z.string().min(1),
  identity: z.object({ user: z.object({ id: z.string() }).nullable() }),
});

export const backendChange = z
  .object({
    latency: z.literal([0, 400, 8_000]).optional(),
    offline: z.boolean().optional(),
    failNext: z.literal(true).optional(),
  })
  .strict();

export const readRequestBody = async (
  request: IncomingMessage,
): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const bytes: unknown = chunk;

    if (!Buffer.isBuffer(bytes)) {
      throw new Error("Expected a byte stream.");
    }

    size += bytes.length;

    if (size > MAX_BODY_BYTES) {
      throw new Error("Request is too large.");
    }

    chunks.push(bytes);
  }

  const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));

  return body;
};
