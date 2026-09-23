import { testReporterAdapter } from "@priemskiyyy/flare/testing";

import { fakeLogger } from "src/fakeLogger.fixture";
import { opentelemetry } from "src/opentelemetry";

testReporterAdapter({
  name: "opentelemetry",
  createAdapter: () => {
    const fake = fakeLogger();

    return opentelemetry({ logger: fake.logger, forceFlush: fake.forceFlush });
  },
});
