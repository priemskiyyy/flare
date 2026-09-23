// @vitest-environment jsdom
import { Flare } from "@priemskiyyy/flare";
import posthogJs from "posthog-js";
import type { CaptureResult } from "posthog-js";
import { afterEach, beforeAll, expect, test, vi } from "vitest";

import { posthog } from "src/posthog";

const events: CaptureResult[] = [];
let isFiltering = false;

beforeAll(() => {
  // Nothing leaves the test: remote config, flags and batches all end here.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 200 })),
  );
  posthogJs.init("phc_test", {
    api_host: "https://posthog.example.test",
    persistence: "memory",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_exceptions: false,
    disable_session_recording: true,
    disable_surveys: true,
    advanced_disable_flags: true,
    before_send: (event) => {
      if (event === null) {
        return null;
      }

      if (isFiltering) {
        return null;
      }

      events.push(event);

      return event;
    },
  });
});

afterEach(() => {
  events.length = 0;
  isFiltering = false;
  posthogJs.reset();
});

const exceptionEvents = () =>
  events.filter((event) => event.event === "$exception");

test("the real SDK files the event under its own person and merges the report's properties over its own", async () => {
  posthogJs.identify("ada");
  posthogJs.register({ plan: "free", release: "1.2.0" });
  posthogJs.addExceptionStep("buffered for whoever is using the app");

  const flare = new Flare({
    destinations: { posthog: posthog({ sdk: posthogJs }) },
  });

  flare.start();
  flare.user({ id: "ada" });
  flare.breadcrumb("opened", { screen: "cart" });

  const receipt = flare.capture(
    new TypeError("upload failed", { cause: new Error("disk full") }),
    {
      tags: { plan: "pro", distinct_id: "grace" },
      contexts: { upload: { kind: "avatar" }, $set: { email: "x@y.test" } },
      level: "warning",
    },
  );

  const status = await receipt.settled;

  const [event] = exceptionEvents();

  expect(event?.properties).toMatchObject({
    distinct_id: "ada",
    plan: "pro",
    release: "1.2.0",
    upload: { kind: "avatar" },
    $exception_level: "warning",
    "flare.report_id": receipt.id,
    $exception_steps: [{ $message: "opened", screen: "cart" }],
  });
  expect(event?.properties.$exception_list).toMatchObject([
    { type: "TypeError", value: "upload failed" },
    { type: "Error", value: "disk full" },
  ]);
  expect(event?.properties).not.toHaveProperty("$set");
  expect(event?.$set).toBeUndefined();
  expect(status).toMatchObject({
    outcomes: {
      posthog: { status: "submitted", event: { id: event?.uuid } },
    },
  });
  flare.dispose();
});

test("the real SDK's before_send dropping the event is a provider-filtered outcome", async () => {
  const flare = new Flare({
    destinations: { posthog: posthog({ sdk: posthogJs }) },
  });

  flare.start();
  isFiltering = true;

  await expect(flare.capture(new Error("boom")).settled).resolves.toEqual({
    state: "settled",
    outcomes: { posthog: { status: "dropped", reason: "provider-filtered" } },
  });
  flare.dispose();
});
