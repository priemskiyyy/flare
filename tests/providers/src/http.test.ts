import { Flare } from "@priemskiyyy/flare";
import { http } from "@priemskiyyy/flare-http";
import type { HttpAdapterOptions } from "@priemskiyyy/flare-http";
import type { ServerResponse } from "node:http";
import { expect, onTestFinished, test } from "vitest";

import { startReceiver } from "src/startReceiver";

// The application's own client, as the adapter's README writes it.
const createRequest =
  (url: string): HttpAdapterOptions["request"] =>
  async ({ report, signal }) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": report.id,
      },
      body: JSON.stringify(report),
      signal,
    });

    if (!response.ok) {
      throw new Error(`The error report endpoint answered ${response.status}.`);
    }

    const answer: unknown = await response.json();

    if (
      typeof answer !== "object" ||
      answer === null ||
      !("id" in answer) ||
      typeof answer.id !== "string"
    ) {
      return undefined;
    }

    return { id: answer.id };
  };

const createFlare = async (
  answer: (response: ServerResponse) => void,
  timeout = 3_000,
) => {
  const receiver = await startReceiver((_request, response) =>
    answer(response),
  );

  const flare = new Flare({
    destinations: {
      backend: http({ request: createRequest(`${receiver.origin}/reports`) }),
    },
    timeout,
  });

  onTestFinished(async () => {
    flare.dispose();
    await receiver.close();
  });
  flare.start();

  return { flare, receiver };
};

const handleAccepted = (response: ServerResponse) => {
  response.writeHead(202, { "content-type": "application/json" });
  response.end(JSON.stringify({ id: "evt_1" }));
};

test("a report the backend accepted is submitted with its id, sent once, whole and redacted, under its own idempotency key", async () => {
  const { flare, receiver } = await createFlare(handleAccepted);

  flare.user({ id: "ada" });

  const receipt = flare.capture(new TypeError("upload failed"), {
    tags: { area: "upload" },
    contexts: { payment: { invoice: "INV-1", cardToken: "tok_live_4242" } },
  });

  await expect(receipt.settled).resolves.toMatchObject({
    state: "settled",
    outcomes: {
      backend: {
        status: "submitted",
        evidence: "backend-acknowledged",
        event: { id: "evt_1" },
      },
    },
  });
  expect(receiver.requests).toHaveLength(1);

  const [request] = receiver.requests;

  expect(request?.headers["idempotency-key"]).toBe(receipt.id);
  expect(request?.body).not.toContain("tok_live_4242");
  expect(JSON.parse(request?.body ?? "null")).toMatchObject({
    id: receipt.id,
    kind: "exception",
    exception: { name: "TypeError", message: "upload failed" },
    identity: { user: { id: "ada" } },
    tags: { area: "upload" },
    contexts: { payment: { invoice: "INV-1", cardToken: "[Redacted]" } },
    losses: [],
  });
});

test("a backend that answers 503 is a failed outcome with the client's own error", async () => {
  const { flare } = await createFlare((response) => {
    response.writeHead(503).end();
  });

  const status = await flare.capture(new Error("upload failed")).settled;

  expect(status).toMatchObject({
    outcomes: {
      backend: {
        status: "failed",
        error: { message: "The error report endpoint answered 503." },
      },
    },
  });
});

test("a backend slower than the deadline is unconfirmed, and the request is abandoned rather than left open", async () => {
  // The answer never comes; the deadline has to end the request.
  const { flare, receiver } = await createFlare(() => {}, 200);

  const status = await flare.capture(new Error("upload failed")).settled;

  expect(status).toMatchObject({
    outcomes: { backend: { status: "indeterminate", reason: "timeout" } },
  });
  await expect.poll(() => receiver.abandoned.length).toBe(1);
});
