import type { AmbientSnapshot } from "src/types/AmbientSnapshot";
import type { Breadcrumb } from "src/types/Breadcrumb";
import type { DestinationFlushResult } from "src/types/DestinationFlushResult";
import type { DestinationOutcome } from "src/types/DestinationOutcome";
import type { DestinationStatus } from "src/types/DestinationStatus";
import type { FlareDiagnosticEvent } from "src/types/FlareDiagnosticEvent";
import type { ObservableValue } from "src/types/ObservableValue";
import type { ReporterAdapter } from "src/types/ReporterAdapter";
import type { ReporterCapabilities } from "src/types/ReporterCapabilities";
import type { ReporterSession } from "src/types/ReporterSession";
import type { SanitizedReport } from "src/types/SanitizedReport";
import { assertUnreachable } from "src/utils/common/assertUnreachable";
import { deferred } from "src/utils/common/deferred";
import { isPromiseLike } from "src/utils/common/isPromiseLike";
import { ValueStore } from "src/utils/common/ValueStore";
import { parseSubmissionResult } from "src/utils/internal/destinations/parseSubmissionResult";
import { unrefTimer } from "src/utils/internal/destinations/unrefTimer";
import { describeOutcome } from "src/utils/internal/diagnostics/describeOutcome";

type Entry = {
  report: SanitizedReport;
  settle: (outcome: DestinationOutcome) => void;
};

type Buffered = Entry & { acceptedAt: number };

type Flight = {
  entry: Entry;
  controller: AbortController;
  timer: ReturnType<typeof setTimeout>;
  done: ReturnType<typeof deferred<void>>;
};

type State<TNative> =
  | Exclude<DestinationStatus, { state: "ready" }>
  | { state: "ready"; session: ReporterSession<TNative> };

const READY_STATUS: DestinationStatus = Object.freeze({ state: "ready" });

type Options<TNative> = {
  name: string;
  adapter: ReporterAdapter<TNative>;
  buffer: { maxReports: number; maxAgeMs: number };
  deadlineMs: number;
  now: () => number;
  currentGeneration: () => number;
  readAmbient: () => AmbientSnapshot;
  /** Brackets the synchronous part of `submit`, so a capture made from inside it can be refused. */
  submitDepth: { enter: () => void; exit: () => void };
  record: (event: Omit<FlareDiagnosticEvent, "timestamp">) => void;
  changed: () => void;
};

const TIMED_OUT = Symbol("timed out");

/**
 * Owns one destination: its session, its startup buffer, the deadline of
 * every submission and its disposal. Whatever the adapter does, every entry
 * accepted here is settled exactly once.
 */
export class DestinationRuntime<TNative = unknown> {
  readonly capabilities: ReporterCapabilities;
  #options: Options<TNative>;
  #state = new ValueStore<State<TNative>>(Object.freeze({ state: "idle" }));
  #buffer: Buffered[] = [];
  #expiry: ReturnType<typeof setTimeout> | null = null;
  #flights = new Set<Flight>();

  constructor(options: Options<TNative>) {
    this.#options = options;

    const { eventLocal, ...capabilities } = options.adapter.capabilities;

    this.capabilities = Object.freeze({
      ...capabilities,
      eventLocal: Object.freeze({ ...eventLocal }),
    });
  }

  status: ObservableValue<DestinationStatus> = {
    get: () => {
      const current = this.#state.get();

      // The session is private. Observers receive only the public status.
      return current.state === "ready" ? READY_STATUS : current;
    },
    subscribe: this.#state.subscribe,
  };

  get name() {
    return this.#options.name;
  }

  get adapter() {
    return this.#options.adapter;
  }

  /** The provider handle, or `null` unless the destination is ready. Reading it starts nothing. */
  get native() {
    const current = this.#state.get();

    if (current.state !== "ready") {
      return null;
    }

    return current.session.native;
  }

  get buffered() {
    return this.#buffer.length;
  }

  get inFlight() {
    return this.#flights.size;
  }

  /** Opens the adapter. A second call does nothing unless the first start failed. */
  start = () => {
    const current = this.#state.get();

    if (current.state !== "idle" && current.state !== "failed") {
      return;
    }

    // Reserve the start before any observer or availability probe can reenter.
    const attempt = { state: "starting" } as const;

    if (!this.#become(attempt)) {
      return;
    }

    const availability = this.#probe();

    if (this.#state.get() !== attempt) {
      return;
    }

    if (!availability.available) {
      this.#become({ state: "unavailable", reason: availability.reason });
      this.#drain({ status: "skipped", reason: "unavailable" });

      return;
    }

    try {
      const opened = this.#options.adapter.open({ destination: this.name });

      if (isPromiseLike(opened)) {
        Promise.resolve(opened).then(
          (session) => this.#ready(attempt, session),
          (error: unknown) => this.#fail(attempt, error),
        );

        return;
      }

      this.#ready(attempt, opened);
    } catch (error) {
      this.#fail(attempt, error);
    }
  };

  accept = (entry: Entry) => {
    const current = this.#state.get();

    if (current.state === "disposed") {
      this.#settle(entry, { status: "dropped", reason: "disposed" });

      return;
    }

    if (current.state === "unavailable") {
      this.#settle(entry, { status: "skipped", reason: "unavailable" });

      return;
    }

    if (current.state === "ready") {
      this.#submit(current.session, entry);

      return;
    }

    if (
      current.state === "idle" ||
      current.state === "starting" ||
      current.state === "failed"
    ) {
      this.#hold(entry);

      return;
    }

    assertUnreachable(current);
  };

  /** Waits for submissions accepted before the call, then for the provider's own flush. */
  flush = async (
    timeoutMs: number,
  ): Promise<{ drained: boolean; boundary: DestinationFlushResult }> => {
    const current = this.#state.get();

    if (current.state !== "ready") {
      return { drained: false, boundary: { status: "not-ready" } };
    }

    const controller = new AbortController();
    const timeout = deferred<typeof TIMED_OUT>();

    const timer = setTimeout(() => {
      controller.abort();
      timeout.resolve(TIMED_OUT);
    }, timeoutMs);

    unrefTimer(timer);

    try {
      // Later submissions are not in this list, so they cannot extend the wait.
      const accepted = [...this.#flights].map((flight) => flight.done.promise);

      const drained = await Promise.race([
        Promise.all(accepted),
        timeout.promise,
      ]);

      if (drained === TIMED_OUT) {
        return { drained: false, boundary: { status: "timeout" } };
      }

      if (this.#state.get() !== current) {
        return { drained: true, boundary: { status: "not-ready" } };
      }

      const { flush } = current.session;

      if (typeof flush !== "function") {
        return { drained: true, boundary: { status: "unsupported" } };
      }

      const boundary = await Promise.race([
        flush.call(current.session, { timeoutMs, signal: controller.signal }),
        timeout.promise,
      ]);

      if (boundary === TIMED_OUT) {
        return { drained: true, boundary: { status: "timeout" } };
      }

      return { drained: true, boundary };
    } catch (error) {
      return { drained: true, boundary: { status: "failed", error } };
    } finally {
      clearTimeout(timer);
    }
  };

  syncAmbient = (snapshot: AmbientSnapshot) => {
    const current = this.#state.get();

    if (current.state !== "ready") {
      return;
    }

    this.#contain("ambient session failed", () => {
      const ambient = current.session.ambient;
      const session = ambient?.session;

      if (typeof session === "function") {
        return session.call(ambient, snapshot);
      }
    });
  };

  ambientBreadcrumb = (breadcrumb: Breadcrumb) => {
    const current = this.#state.get();

    if (current.state !== "ready") {
      return;
    }

    this.#contain("ambient breadcrumb failed", () => {
      const ambient = current.session.ambient;
      const push = ambient?.breadcrumb;

      if (typeof push === "function") {
        return push.call(ambient, breadcrumb);
      }
    });
  };

  dispose = () => {
    const current = this.#state.get();

    if (current.state === "disposed") {
      return;
    }

    this.#become({ state: "disposed" });
    this.#drain({ status: "dropped", reason: "disposed" });

    for (const flight of [...this.#flights]) {
      flight.controller.abort();
      this.#land(flight, { status: "indeterminate", reason: "disposed" });
    }

    if (current.state === "ready") {
      this.#release(current.session);
    }
  };

  #probe() {
    try {
      return this.#options.adapter.available();
    } catch {
      return {
        available: false,
        reason: "The availability probe threw.",
      } as const;
    }
  }

  #ready(attempt: object, session: ReporterSession<TNative>) {
    const current = this.#state.get();

    // Disposed, or restarted, while this session was opening: it has no owner.
    if (current !== attempt) {
      this.#release(session);

      return;
    }

    if (!this.#become({ state: "ready", session })) {
      return;
    }

    this.syncAmbient(this.#options.readAmbient());

    const waiting = this.#buffer.splice(0);

    this.#scheduleExpiry();

    for (const entry of waiting) {
      this.accept(entry);
    }
  }

  #fail(attempt: object, error: unknown) {
    const current = this.#state.get();

    if (current !== attempt) {
      return;
    }

    // The buffer is kept: a later start() may still deliver it before it expires.
    this.#become({ state: "failed", error });
  }

  #become(state: State<TNative>) {
    this.#state.set(Object.freeze(state));

    if (this.#state.get() !== state) {
      return false;
    }

    this.#options.record({
      source: "destination",
      type: `destination ${state.state}`,
      destination: this.name,
      report: null,
      context: null,
    });
    this.#options.changed();

    return this.#state.get() === state;
  }

  #hold(entry: Entry) {
    this.#buffer.push({ ...entry, acceptedAt: this.#options.now() });

    if (this.#buffer.length > this.#options.buffer.maxReports) {
      const pushedOut = this.#buffer.shift();

      if (pushedOut !== undefined) {
        this.#settle(pushedOut, {
          status: "dropped",
          reason: "buffer-overflow",
        });
      }
    }

    this.#options.record({
      source: "destination",
      type: "report buffered",
      destination: this.name,
      report: entry.report.id,
      context: { buffered: this.#buffer.length },
    });
    this.#scheduleExpiry();
    this.#options.changed();
  }

  #drain(outcome: DestinationOutcome) {
    const waiting = this.#buffer.splice(0);

    this.#scheduleExpiry();

    for (const entry of waiting) {
      this.#settle(entry, outcome);
    }
  }

  // One timer, always for the oldest report, so an unstarted destination still settles its receipts.
  #scheduleExpiry() {
    if (this.#expiry !== null) {
      clearTimeout(this.#expiry);
      this.#expiry = null;
    }

    const oldest = this.#buffer[0];

    if (oldest === undefined) {
      return;
    }

    const { now, buffer } = this.#options;
    const delay = Math.max(0, oldest.acceptedAt + buffer.maxAgeMs - now());

    this.#expiry = setTimeout(this.#expire, delay);
    unrefTimer(this.#expiry);
  }

  #expire = () => {
    const { now, buffer } = this.#options;

    const outcome: DestinationOutcome =
      this.#state.get().state === "failed"
        ? { status: "skipped", reason: "start-failed" }
        : { status: "dropped", reason: "buffer-expired" };

    while (this.#buffer.length > 0) {
      const oldest = this.#buffer[0];

      if (oldest === undefined || now() - oldest.acceptedAt < buffer.maxAgeMs) {
        break;
      }

      this.#buffer.shift();
      this.#settle(oldest, outcome);
    }

    this.#scheduleExpiry();
    this.#options.changed();
  };

  #submit(session: ReporterSession<TNative>, entry: Entry) {
    const { deadlineMs, currentGeneration, submitDepth } = this.#options;

    if (entry.report.kind === "message" && !this.capabilities.messages) {
      this.#settle(entry, {
        status: "skipped",
        reason: "unsupported-report-kind",
      });

      return;
    }

    const controller = new AbortController();

    const flight: Flight = {
      entry,
      controller,
      done: deferred<void>(),
      timer: setTimeout(() => {
        controller.abort();
        // The provider may still send it: a deadline proves nothing either way.
        this.#land(flight, { status: "indeterminate", reason: "deadline" });
      }, deadlineMs),
    };

    unrefTimer(flight.timer);
    this.#flights.add(flight);

    this.#options.record({
      source: "destination",
      type: "destination submit",
      destination: this.name,
      report: entry.report.id,
      context: null,
    });

    if (!this.#flights.has(flight)) {
      return;
    }

    let answer: ReturnType<ReporterSession["submit"]>;

    submitDepth.enter();

    try {
      answer = session.submit(entry.report, {
        signal: controller.signal,
        currentGeneration,
      });

      if (isPromiseLike(answer)) {
        Promise.resolve(answer).then(
          (result) => this.#land(flight, this.#toOutcome(result)),
          (error: unknown) => this.#land(flight, { status: "failed", error }),
        );

        return;
      }
    } catch (error) {
      this.#land(flight, { status: "failed", error });

      return;
    } finally {
      submitDepth.exit();
    }

    this.#land(flight, this.#toOutcome(answer));
  }

  #toOutcome(result: unknown): DestinationOutcome {
    try {
      const parsed = parseSubmissionResult(result);

      if (parsed !== null) {
        return parsed;
      }
    } catch (error) {
      return { status: "failed", error };
    }

    return {
      status: "failed",
      error: new Error(
        `The ${this.#options.adapter.name} adapter answered submit with an unknown result.`,
      ),
    };
  }

  // The first landing stands: a late answer finds its flight already gone.
  #land(flight: Flight, outcome: DestinationOutcome) {
    if (!this.#flights.delete(flight)) {
      return;
    }

    clearTimeout(flight.timer);
    this.#settle(flight.entry, outcome);
    flight.done.resolve();
  }

  #settle(entry: Entry, outcome: DestinationOutcome) {
    entry.settle(outcome);
    this.#options.record({
      source: "destination",
      type: "destination outcome",
      destination: this.name,
      report: entry.report.id,
      context: describeOutcome(outcome),
    });
    this.#options.changed();
  }

  #release(session: ReporterSession<TNative>) {
    this.#contain("destination dispose failed", () => session.dispose());
  }

  #contain(type: string, task: () => unknown) {
    try {
      const result = task();

      if (result !== undefined) {
        Promise.resolve(result).catch(() => this.#recordFailure(type));
      }
    } catch {
      this.#recordFailure(type);
    }
  }

  #recordFailure(type: string) {
    this.#options.record({
      source: "destination",
      type,
      destination: this.name,
      report: null,
      context: null,
    });
  }
}
