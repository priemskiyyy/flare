import { Flare } from "@priemskiyyy/flare";
import { sentry } from "@priemskiyyy/flare-sentry";
import * as Sentry from "@sentry/browser";
import type { ServerResponse } from "node:http";
import { afterEach, expect, onTestFinished, test } from "vitest";

import { readField } from "src/readField";
import { startReceiver } from "src/startReceiver";
import type { ReceivedRequest } from "src/types/ReceivedRequest";

afterEach(async () => {
  await Sentry.close();
  Sentry.getIsolationScope().clear();
  Sentry.getCurrentScope().clear();
});

const handleAccepted = (response: ServerResponse) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end("{}");
};

/** An envelope is a header line, then a header and a payload line per item. */
const readEvents = (requests: ReceivedRequest[]) =>
  requests
    .filter((request) => request.path.startsWith("/api/1/envelope/"))
    .flatMap((request) => {
      const [, ...items] = request.body.split("\n");
      const events: unknown[] = [];

      for (let index = 0; index + 1 < items.length; index += 2) {
        const header: unknown = JSON.parse(items[index] ?? "null");

        if (readField(header, "type") === "event") {
          events.push(JSON.parse(items[index + 1] ?? "null"));
        }
      }

      return events;
    });

const createFlare = async (answer = handleAccepted) => {
  const receiver = await startReceiver((_request, response) =>
    answer(response),
  );

  const { port } = new URL(receiver.origin);

  Sentry.init({
    dsn: `http://public@127.0.0.1:${port}/1`,
    defaultIntegrations: [],
    sendClientReports: false,
  });

  const flare = new Flare({
    destinations: { sentry: sentry({ sdk: Sentry }) },
  });

  onTestFinished(async () => {
    flare.dispose();
    await receiver.close();
  });
  flare.start();

  return { flare, receiver };
};

test("the event Sentry sends carries the report, redacted, under the event id the receipt names", async () => {
  const { flare, receiver } = await createFlare();

  flare.user({ id: "ada", email: "ada@acme.test" });
  flare.breadcrumb("opened", { screen: "cart" });

  const receipt = flare.capture(new TypeError("upload failed"), {
    tags: { area: "upload" },
    contexts: { payment: { invoice: "INV-1", cardToken: "tok_live_4242" } },
  });

  const status = await receipt.settled;

  await flare.flush();

  const [event] = readEvents(receiver.requests);

  expect(receiver.requests.map((request) => request.body).join()).not.toContain(
    "tok_live_4242",
  );
  expect(event).toMatchObject({
    level: "error",
    exception: { values: [{ type: "TypeError", value: "upload failed" }] },
    user: { id: "ada", email: "ada@acme.test" },
    tags: { area: "upload", "flare.report_id": receipt.id },
    contexts: { payment: { invoice: "INV-1", cardToken: "[Redacted]" } },
    breadcrumbs: [{ message: "opened", data: { screen: "cart" } }],
  });
  expect(status).toMatchObject({
    outcomes: {
      sentry: {
        status: "submitted",
        evidence: "sdk-call-returned",
        event: { id: readField(event, "event_id") },
      },
    },
  });
});

test("a message goes out as a message event at its own level", async () => {
  const { flare, receiver } = await createFlare();

  const receipt = flare.message("The reminder bounced", { level: "warning" });

  await receipt.settled;
  await flare.flush();

  expect(readEvents(receiver.requests)).toMatchObject([
    {
      level: "warning",
      message: "The reminder bounced",
      tags: { "flare.report_id": receipt.id },
    },
  ]);
});

test("flush waits until Sentry's transport has its answer from the server", async () => {
  let isAnswered = false;

  const { flare } = await createFlare((response) => {
    setTimeout(() => {
      handleAccepted(response);
      isAnswered = true;
    }, 300);
  });

  await flare.capture(new Error("upload failed")).settled;

  expect(isAnswered).toBe(false);
  await expect(flare.flush({ timeout: 2_000 })).resolves.toMatchObject({
    destinations: { sentry: { status: "flushed" } },
  });
  expect(isAnswered).toBe(true);
});
