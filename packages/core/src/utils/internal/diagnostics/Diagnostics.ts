import type { FlareDiagnosticEvent } from "src/types/FlareDiagnosticEvent";
import type { FlareDiagnostics } from "src/types/FlareDiagnostics";
import type { FlareSnapshot } from "src/types/FlareSnapshot";
import { copyFrozen } from "src/utils/common/copyFrozen";
import { isolate } from "src/utils/common/isolate";

type State =
  | {
      state: "ACTIVE";
      read: () => FlareSnapshot;
      snapshot: FlareSnapshot | undefined;
    }
  | { state: "DISPOSED"; snapshot: FlareSnapshot };

/** What an owner records. What it leaves out is `null` on the published event. */
export type RecordedEvent = {
  source: FlareDiagnosticEvent["source"];
  type: string;
  destination?: string | undefined;
  report?: string | undefined;
  context?: unknown;
};

/** Lazy snapshots and microtask-batched notifications, closed after the final disposal event. */
export class Diagnostics {
  #state: State;
  #now: () => number;
  #listeners = new Set<() => void>();
  #eventListeners = new Set<(event: FlareDiagnosticEvent) => void>();
  #scheduled = false;

  constructor({ read, now }: { read: () => FlareSnapshot; now: () => number }) {
    this.#state = { state: "ACTIVE", read, snapshot: undefined };
    this.#now = now;
  }

  api: FlareDiagnostics = {
    get: () => {
      const state = this.#state;

      if (state.state === "DISPOSED") {
        return state.snapshot;
      }

      if (state.snapshot === undefined) {
        state.snapshot = state.read();
      }

      return state.snapshot;
    },
    subscribe: (listener) => {
      if (this.#state.state === "DISPOSED") {
        return () => {};
      }

      const notify = () => listener();

      this.#listeners.add(notify);

      return () => {
        this.#listeners.delete(notify);
      };
    },
    events: {
      subscribe: (listener: (event: FlareDiagnosticEvent) => void) => {
        if (this.#state.state === "DISPOSED") {
          return () => {};
        }

        const handle = (event: FlareDiagnosticEvent) => listener(event);

        this.#eventListeners.add(handle);

        return () => {
          this.#eventListeners.delete(handle);
        };
      },
    },
  };

  changed = () => {
    if (this.#state.state === "DISPOSED") {
      return;
    }

    this.#state.snapshot = undefined;

    if (this.#listeners.size === 0 || this.#scheduled) {
      return;
    }

    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#notify();
    });
  };

  record = (event: RecordedEvent) => {
    if (this.#state.state === "DISPOSED") {
      return;
    }

    this.#emit(event);
  };

  dispose = () => {
    if (this.#state.state === "DISPOSED") {
      return;
    }

    this.#state = { state: "DISPOSED", snapshot: this.#state.read() };
    this.#emit({ source: "runtime", type: "disposed" });
    this.#notify();
    this.#listeners.clear();
    this.#eventListeners.clear();
  };

  #notify() {
    for (const listener of [...this.#listeners]) {
      if (!this.#listeners.has(listener)) {
        continue;
      }

      isolate(listener);
    }
  }

  // Events are only assembled while someone listens.
  #emit(recorded: RecordedEvent) {
    if (this.#eventListeners.size === 0) {
      return;
    }

    // Every listener receives the same event, so none can change it for the next.
    const event: FlareDiagnosticEvent = Object.freeze({
      source: recorded.source,
      type: recorded.type,
      destination: recorded.destination ?? null,
      report: recorded.report ?? null,
      timestamp: this.#now(),
      context: copyFrozen(recorded.context ?? null),
    });

    for (const listener of [...this.#eventListeners]) {
      if (!this.#eventListeners.has(listener)) {
        continue;
      }

      isolate(() => listener(event));
    }
  }
}
