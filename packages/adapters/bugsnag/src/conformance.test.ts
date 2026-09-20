import { testReporterAdapter } from "@priemskiyyy/flare/testing";

import { bugsnag } from "src/bugsnag";
import { bugsnag as bugsnagReactNative } from "src/bugsnagReactNative";
import { fakeBugsnag } from "src/fakeBugsnag.fixture";

testReporterAdapter({
  name: "bugsnag",
  createAdapter: () => bugsnag({ sdk: fakeBugsnag().sdk }),
});

testReporterAdapter({
  name: "bugsnag with breadcrumbs, messages and every ambient part",
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

testReporterAdapter({
  name: "bugsnag on React Native",
  createAdapter: () => bugsnagReactNative({ sdk: fakeBugsnag().sdk }),
});
