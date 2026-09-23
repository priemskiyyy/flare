import type { ObservableValue } from "@priemskiyyy/flare";
import type { HttpAdapterOptions } from "@priemskiyyy/flare-http";

import type { BackendState } from "src/types/BackendState";
import type { EventLog } from "src/types/EventLog";
import type { NetworkRequest } from "src/types/NetworkRequest";

export type ReportBackend = {
  request: HttpAdapterOptions["request"];
  requests: EventLog<NetworkRequest>;
  state: ObservableValue<BackendState>;
  setLatency: (latency: number) => void;
  setOffline: (offline: boolean) => void;
  failNextRequest: () => void;
};
