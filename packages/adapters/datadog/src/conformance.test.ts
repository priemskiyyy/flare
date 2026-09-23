import { testReporterAdapter } from "@priemskiyyy/flare/testing";

import { datadog } from "src/datadog";
import { fakeDatadogRum } from "src/fakeDatadogRum.fixture";

testReporterAdapter({
  name: "datadog",
  createAdapter: () => datadog({ sdk: fakeDatadogRum().sdk }),
});
