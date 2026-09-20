import type { ObservableValue } from "@priemskiyyy/flare";
import type { FetchLike } from "@priemskiyyy/flare-http";

type ReceivedReport = { id: string; body: unknown };

/** An in-page HTTP endpoint. Only the sanitized request body reaches the inspector. */
export const createExampleBackend = () => {
  let received: ReceivedReport | null = null;
  const listeners = new Set<() => void>();
  const report: ObservableValue<ReceivedReport | null> = {
    get: () => received,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const fetch: FetchLike = (_url, { headers, body, signal }) =>
    new Promise((resolve, reject) => {
      const id = headers["idempotency-key"];
      if (id === undefined) {
        throw new Error("The demo backend requires a report id.");
      }
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      const payload: unknown = JSON.parse(body);
      const handleAbort = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", handleAbort);
        received = { id, body: payload };
        for (const listener of listeners) {
          listener();
        }
        resolve({
          ok: true,
          status: 201,
          json: async () => ({ id: `evt_${id}` }),
        });
      }, 400);
      signal.addEventListener("abort", handleAbort, { once: true });
    });

  return { fetch, report };
};
