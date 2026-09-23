import { testReporterAdapter } from "@priemskiyyy/flare/testing";

import { fakeRequest } from "src/fakeRequest.fixture";
import { http } from "src/http";

testReporterAdapter({
  name: "http",
  createAdapter: () => http({ request: fakeRequest().request }),
});
