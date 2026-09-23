import { testReporterAdapter } from "@priemskiyyy/flare/testing";

import { console } from "src/console";

testReporterAdapter({
  name: "console",
  createAdapter: () => console({ writer: () => {} }),
});
