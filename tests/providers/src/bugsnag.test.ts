// @vitest-environment jsdom
import Bugsnag, { Breadcrumb } from "@bugsnag/js";
import { Flare } from "@priemskiyyy/flare";
import { bugsnag } from "@priemskiyyy/flare-bugsnag";
import type { ServerResponse } from "node:http";
import { afterAll, beforeAll, expect, onTestFinished, test } from "vitest";

import { readField } from "src/readField";
import { readItems } from "src/readItems";
import { startReceiver } from "src/startReceiver";

let receiver: Awaited<ReturnType<typeof startReceiver>>;

let answer = (response: ServerResponse) => {
  response.writeHead(202).end();
};

beforeAll(async () => {
  receiver = await startReceiver((_request, response) => answer(response));
  Bugsnag.start({
    apiKey: "0123456789abcdef0123456789abcdef",
    endpoints: {
      notify: `${receiver.origin}/notify`,
      sessions: `${receiver.origin}/sessions`,
    },
    autoTrackSessions: false,
    autoDetectErrors: false,
    enabledBreadcrumbTypes: [],
    logger: null,
  });
});

afterAll(async () => {
  await receiver.close();
});

const readEvents = () => readItems(receiver.requests, "/notify", "events");

const findEvent = (reportId: string) =>
  readEvents().find(
    (event) =>
      readField(
        readField(readField(event, "metaData"), "flare"),
        "report_id",
      ) === reportId,
  );

const createFlare = () => {
  const flare = new Flare({
    destinations: { bugsnag: bugsnag({ sdk: Bugsnag, Breadcrumb }) },
  });

  onTestFinished(() => flare.dispose());
  flare.start();

  return flare;
};

test("a report is submitted only once the server has answered Bugsnag's delivery, and carries the report, redacted", async () => {
  const held: ServerResponse[] = [];

  answer = (response) => held.push(response);

  const flare = createFlare();

  flare.user({ id: "ada", email: "ada@acme.test" });

  const receipt = flare.capture(new TypeError("upload failed"), {
    tags: { area: "upload" },
    contexts: { payment: { invoice: "INV-1", cardToken: "tok_live_4242" } },
  });

  await expect.poll(() => findEvent(receipt.id)).toBeDefined();
  expect(receipt.status.get().state).toBe("pending");

  for (const response of held) {
    response.writeHead(202).end();
  }

  await expect(receipt.settled).resolves.toMatchObject({
    outcomes: {
      bugsnag: { status: "submitted", evidence: "sdk-callback-completed" },
    },
  });

  const event = findEvent(receipt.id);

  expect(JSON.stringify(event)).not.toContain("tok_live_4242");
  expect(event).toMatchObject({
    exceptions: [{ errorClass: "TypeError", message: "upload failed" }],
    user: { id: "ada", email: "ada@acme.test" },
    app: { type: "browser" },
    metaData: {
      tags: { area: "upload" },
      payment: { invoice: "INV-1", cardToken: "[Redacted]" },
    },
  });
});

test("a delivery the server refuses is a failed outcome", async () => {
  answer = (response) => {
    response.writeHead(500).end();
  };

  const flare = createFlare();

  const status = await flare.capture(new Error("upload failed")).settled;

  expect(status).toMatchObject({ outcomes: { bugsnag: { status: "failed" } } });
});
