import type { ObservableValue } from "@priemskiyyy/flare";
import type {
  HttpAcknowledgement,
  HttpAdapterOptions,
} from "@priemskiyyy/flare-http";

import type { BackendState } from "examples/shared/ledger/types/BackendState";
import type { EventLog } from "examples/shared/ledger/types/EventLog";
import type { NetworkRequest } from "examples/shared/ledger/types/NetworkRequest";

export type ReportBackend = {
  request: HttpAdapterOptions["request"];
  /** Answers one report by its id, or throws as a 503 would. */
  receive: (delivery: {
    reportId: string;
    account: string | null;
    signal: AbortSignal;
  }) => Promise<HttpAcknowledgement>;
  requests: EventLog<NetworkRequest>;
  state: ObservableValue<BackendState>;
  setLatency: (latency: number) => void;
  setOffline: (offline: boolean) => void;
  failNextRequest: () => void;
};
