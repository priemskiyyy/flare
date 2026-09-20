import { testReporterAdapter } from "@priemskiyyy/flare/testing";

import { consoleReporter } from "src/consoleReporter";

testReporterAdapter({
  name: "console",
  createAdapter: () => consoleReporter({ writer: () => {} }),
});
