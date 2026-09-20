import { testReporterAdapter } from "@priemskiyyy/flare/testing";

import { crashlytics } from "src/crashlytics";
import { fakeCrashlytics } from "src/fakeCrashlytics.fixture";

testReporterAdapter({
  name: "crashlytics",
  createAdapter: () => crashlytics({ sdk: fakeCrashlytics().sdk }),
});

testReporterAdapter({
  name: "crashlytics with every ambient part",
  createAdapter: () =>
    crashlytics({
      sdk: fakeCrashlytics().sdk,
      ambient: { user: true, tags: true, contexts: true, breadcrumbs: true },
    }),
});
