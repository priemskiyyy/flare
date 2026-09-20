import { testReporterAdapter } from "@priemskiyyy/flare/testing";

import { fakeBackend } from "src/fakeBackend.fixture";
import { http } from "src/http";

testReporterAdapter({
  name: "http",
  createAdapter: () => {
    const backend = fakeBackend();

    return http({ endpoint: backend.endpoint, fetch: backend.fetch });
  },
});
