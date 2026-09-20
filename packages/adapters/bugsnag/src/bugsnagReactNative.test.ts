import { Flare } from "@priemskiyyy/flare";
import { expect, test } from "vitest";

import { bugsnag } from "src/bugsnagReactNative";
import { fakeBugsnag } from "src/fakeBugsnag.fixture";

test("on React Native the native layer stores events and sends them later", () => {
  expect(bugsnag({ sdk: fakeBugsnag().sdk }).capabilities).toMatchObject({
    queue: "sdk-persistent",
    flush: "none",
    evidence: "sdk-callback-completed",
    automaticCapture: "provider-owned",
    instance: "singleton",
  });
});

test("reports are mapped the same way as in the browser", () => {
  const fake = fakeBugsnag();
  const flare = new Flare({
    destinations: { bugsnag: bugsnag({ sdk: fake.sdk }) },
  });
  flare.start();

  flare.capture(new Error("boom"), {
    tags: { area: "upload" },
    user: { id: "ada" },
  });

  expect(fake.events[0]).toMatchObject({
    user: { id: "ada" },
    metadata: { tags: { area: "upload" } },
  });
  expect(fake.client.user).toEqual({});
});
