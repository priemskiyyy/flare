import type { NetworkRequest } from "examples/shared/ledger/types/NetworkRequest";
import type { ReportBackend } from "examples/shared/ledger/types/ReportBackend";
import { createEventLog } from "examples/shared/ledger/utils/createEventLog";
import { createValueStore } from "examples/shared/ledger/utils/createValueStore";
import { wait } from "examples/shared/ledger/utils/wait";

/**
 * Your API and the client that calls it, inside the page. The lab sets its
 * latency, takes it offline or fails the next request, and every request
 * lands in the network log.
 */
export const createReportBackend = ({
  latency,
}: {
  latency: number;
}): ReportBackend => {
  const requests = createEventLog<NetworkRequest>(30);
  const state = createValueStore({ latency, offline: false, failNext: false });
  let nextId = 1;

  const record = (entry: Omit<NetworkRequest, "id" | "at">) => {
    requests.add({ ...entry, id: nextId, at: Date.now() });
    nextId += 1;
  };

  return {
    request: async ({ report, signal }) => {
      const startedAt = Date.now();
      const account = report.identity.user?.id ?? null;

      try {
        await wait(state.get().latency, signal);
      } catch (error) {
        record({
          reportId: report.id,
          account,
          outcome: "aborted",
          duration: Date.now() - startedAt,
        });

        throw error;
      }

      const current = state.get();

      if (current.offline || current.failNext) {
        state.set({ ...current, failNext: false });
        record({
          reportId: report.id,
          account,
          outcome: "failed",
          duration: Date.now() - startedAt,
        });

        throw new Error("The report endpoint answered 503.");
      }

      record({
        reportId: report.id,
        account,
        outcome: "accepted",
        duration: Date.now() - startedAt,
      });

      return { id: `evt_${report.id.slice(0, 8)}` };
    },
    requests: requests.log,
    state,
    setLatency: (next) => state.set({ ...state.get(), latency: next }),
    setOffline: (offline) => state.set({ ...state.get(), offline }),
    failNextRequest: () => state.set({ ...state.get(), failNext: true }),
  };
};
