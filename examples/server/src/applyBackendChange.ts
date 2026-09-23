import type { z } from "zod";

import type { ReportBackend } from "examples/shared/ledger/types/ReportBackend";
import type { backendChange } from "src/requests";

export const applyBackendChange = (
  backend: ReportBackend,
  change: z.infer<typeof backendChange>,
) => {
  if (change.latency !== undefined) {
    backend.setLatency(change.latency);
  }

  if (change.offline !== undefined) {
    backend.setOffline(change.offline);
  }

  if (change.failNext !== undefined) {
    backend.failNextRequest();
  }
};
