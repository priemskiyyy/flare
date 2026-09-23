import { testReporterAdapter } from "@priemskiyyy/flare/testing";

import { fakePostHog } from "src/fakePostHog.fixture";
import { posthog } from "src/posthog";

testReporterAdapter({
  name: "posthog",
  createAdapter: () => posthog({ sdk: fakePostHog().sdk }),
});
