// @vitest-environment jsdom
import { Flare } from "@priemskiyyy/flare";
import { posthog } from "@priemskiyyy/flare-posthog";
import posthogJs from "posthog-js";
import {
  afterAll,
  afterEach,
  beforeAll,
  expect,
  onTestFinished,
  test,
} from "vitest";

import { readField } from "src/readField";
import { readItems } from "src/readItems";
import { startReceiver } from "src/startReceiver";

let receiver: Awaited<ReturnType<typeof startReceiver>>;
let isFiltering = false;

beforeAll(async () => {
  receiver = await startReceiver((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
  });
  posthogJs.init("phc_test", {
    api_host: receiver.origin,
    persistence: "memory",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_exceptions: false,
    disable_session_recording: true,
    disable_surveys: true,
    advanced_disable_flags: true,
    // Plain JSON, one request per event, so each one can be read as it arrives.
    disable_compression: true,
    request_batching: false,
    before_send: (event) => {
      if (isFiltering) {
        return null;
      }

      return event;
    },
  });
});

afterEach(() => {
  isFiltering = false;
  posthogJs.reset();
});

afterAll(async () => {
  await receiver.close();
});

const readEvents = () => readItems(receiver.requests, "/e/", "batch");

const findEvent = (reportId: string) =>
  readEvents().find(
    (event) =>
      readField(readField(event, "properties"), "flare.report_id") === reportId,
  );

const createFlare = () => {
  const flare = new Flare({
    destinations: { posthog: posthog({ sdk: posthogJs }) },
  });

  onTestFinished(() => flare.dispose());
  flare.start();

  return flare;
};

test("the $exception event PostHog sends carries the report, redacted, under the uuid the receipt names", async () => {
  const flare = createFlare();

  posthogJs.identify("ada");
  flare.user({ id: "ada" });

  const receipt = flare.capture(new TypeError("upload failed"), {
    tags: { area: "upload" },
    contexts: { payment: { invoice: "INV-1", cardToken: "tok_live_4242" } },
  });

  const status = await receipt.settled;

  await expect.poll(() => findEvent(receipt.id)).toBeDefined();

  const event = findEvent(receipt.id);

  expect(JSON.stringify(event)).not.toContain("tok_live_4242");
  expect(event).toMatchObject({
    event: "$exception",
    properties: {
      distinct_id: "ada",
      area: "upload",
      payment: { invoice: "INV-1", cardToken: "[Redacted]" },
      $exception_list: [{ type: "TypeError", value: "upload failed" }],
    },
  });
  expect(status).toMatchObject({
    outcomes: {
      posthog: {
        status: "submitted",
        evidence: "sdk-call-returned",
        event: { id: readField(event, "uuid") },
      },
    },
  });
});

test("an event PostHog's own filters drop is dropped as provider-filtered, and never sent", async () => {
  const flare = createFlare();

  isFiltering = true;

  const receipt = flare.capture(new Error("upload failed"));
  const status = await receipt.settled;

  isFiltering = false;
  // A later event that does arrive shows the filtered one had its chance.
  posthogJs.capture("barrier");
  await expect
    .poll(() =>
      readEvents().some((event) => readField(event, "event") === "barrier"),
    )
    .toBe(true);

  expect(status).toMatchObject({
    outcomes: { posthog: { status: "dropped", reason: "provider-filtered" } },
  });
  expect(findEvent(receipt.id)).toBeUndefined();
});
