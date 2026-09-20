import { Flare } from "@priemskiyyy/flare";
import { expect, test } from "vitest";

import { fakeSentry } from "src/fakeSentry.fixture";
import { sentry } from "src/sentryReactNative";

test("on React Native, flush is a handoff to the native SDK and the queue survives restarts", () => {
  expect(sentry({ sdk: fakeSentry().sdk }).capabilities).toMatchObject({
    flush: "native-handoff",
    queue: "sdk-persistent",
    evidence: "sdk-call-returned",
    automaticCapture: "provider-owned",
    instance: "singleton",
  });
});

test("reports are mapped the same way as in the browser", () => {
  const fake = fakeSentry();
  const flare = new Flare({
    destinations: { sentry: sentry({ sdk: fake.sdk }) },
  });
  flare.start();

  flare.capture(new Error("boom"), {
    tags: { area: "upload" },
    user: { id: "ada" },
  });

  expect(fake.events[0]).toMatchObject({
    kind: "exception",
    scope: { user: { id: "ada" }, tags: { area: "upload" } },
  });
  expect(fake.global.user).toBeNull();
});
