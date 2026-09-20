import { testReporterAdapter } from "@priemskiyyy/flare/testing";

import { fakeSentry } from "src/fakeSentry.fixture";
import { sentry } from "src/sentry";
import { sentry as sentryReactNative } from "src/sentryReactNative";

testReporterAdapter({
  name: "sentry",
  createAdapter: () => sentry({ sdk: fakeSentry().sdk }),
});

testReporterAdapter({
  name: "sentry with every ambient part",
  createAdapter: () =>
    sentry({
      sdk: fakeSentry().sdk,
      ambient: { user: true, tags: true, contexts: true, breadcrumbs: true },
    }),
});

testReporterAdapter({
  name: "sentry on React Native",
  createAdapter: () => sentryReactNative({ sdk: fakeSentry().sdk }),
});
