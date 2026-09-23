import { testReporterAdapter } from "@priemskiyyy/flare/testing";

import { fakePostHog } from "src/fakePostHog.fixture";
import { posthog } from "src/posthog";

testReporterAdapter({
  name: "posthog-react-native",
  createAdapter: () => posthog({ sdk: fakePostHog().sdk }),
});
