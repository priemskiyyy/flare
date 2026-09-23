import { testReporterAdapter } from "@priemskiyyy/flare/testing";

import { datadogLogs } from "src/datadogLogs";
import { fakeDatadogLogs } from "src/fakeDatadogLogs.fixture";

testReporterAdapter({
  name: "datadog-logs",
  createAdapter: () => {
    const fake = fakeDatadogLogs();

    fake.sdk.setUser({ id: "conformance-user" });

    return datadogLogs({ sdk: fake.sdk });
  },
});
