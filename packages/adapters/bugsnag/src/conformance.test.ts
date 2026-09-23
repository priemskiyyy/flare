import { testReporterAdapter } from "@priemskiyyy/flare/testing";

import { bugsnag } from "src/bugsnag";
import { fakeBugsnag } from "src/fakeBugsnag.fixture";

testReporterAdapter({
  name: "bugsnag",
  createAdapter: () => {
    const fake = fakeBugsnag();

    return bugsnag({ sdk: fake.sdk, Breadcrumb: fake.Breadcrumb });
  },
});

testReporterAdapter({
  name: "bugsnag with messages and every ambient part",
  createAdapter: () => {
    const fake = fakeBugsnag();

    return bugsnag({
      sdk: fake.sdk,
      Breadcrumb: fake.Breadcrumb,
      messages: "as-error",
      ambient: { user: true, tags: true, contexts: true, breadcrumbs: true },
    });
  },
});
