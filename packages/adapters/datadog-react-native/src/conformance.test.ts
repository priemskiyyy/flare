import { testReporterAdapter } from "@priemskiyyy/flare/testing";

import { datadog } from "src/datadog";
import { fakeDdRum } from "src/fakeDdRum.fixture";

testReporterAdapter({
  name: "datadog-react-native",
  createAdapter: () => datadog({ sdk: fakeDdRum().sdk }),
});
