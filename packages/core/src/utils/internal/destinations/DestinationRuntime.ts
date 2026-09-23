import type { AmbientReporterContext } from "src/types/AmbientReporterContext";
import type { AmbientSnapshot } from "src/types/AmbientSnapshot";
import type { Breadcrumb } from "src/types/Breadcrumb";
import type { DestinationFlushResult } from "src/types/DestinationFlushResult";
import type { DestinationOutcome } from "src/types/DestinationOutcome";
import type { DestinationStatus } from "src/types/DestinationStatus";
import type { ObservableValue } from "src/types/ObservableValue";
import type { ReporterAdapter } from "src/types/ReporterAdapter";
import type { ReporterSession } from "src/types/ReporterSession";
import type { SanitizedReport } from "src/types/SanitizedReport";
import type { SubmissionResult } from "src/types/SubmissionResult";
import { assertUnreachable } from "src/utils/common/assertUnreachable";
import { createDeferred } from "src/utils/common/createDeferred";
import { isPromiseLike } from "src/utils/common/isPromiseLike";
import { ValueStore } from "src/utils/common/ValueStore";
import {
  DISPOSED_DESTINATION_STATUS,
  IDLE_DESTINATION_STATUS,
  READY_DESTINATION_STATUS,
} from "src/utils/constants/status";
import { FlareError } from "src/utils/FlareError";
import { copyFlushResult } from "src/utils/internal/destinations/copyFlushResult";
import { copySubmissionOutcome } from "src/utils/internal/destinations/copySubmissionOutcome";
import { unrefTimer } from "src/utils/internal/destinations/unrefTimer";
import type { RecordedEvent } from "src/utils/internal/diagnostics/Diagnostics";
import { describeOutcome } from "src/utils/internal/diagnostics/describeOutcome";
import { DedupeIndex } from "src/utils/internal/dispatch/DedupeIndex";

type Entry = {
  report: SanitizedReport;
  settle: (outcome: DestinationOutcome) => void;
};

/** What identifies a capture for dedupe. It is read on arrival and never retained. */
type Occurrence = { key: string | null; thrown: unknown };

type Buffered = Entry & { acceptedAt: number };

type Flight = {
  entry: Entry;
  controller: AbortController;
  timer: ReturnType<typeof setTimeout>;
  done: ReturnType<typeof createDeferred<void>>;
};

/** A session, and the two fields read from it once, when it was opened. */
type OpenedSession<TNative> = {
  session: ReporterSession<TNative>;
  native: TNative;
  ambient: AmbientReporterContext | undefined;
};

type State<TNative> =
  | Exclude<DestinationStatus, { state: "ready" }>
  | ({ state: "ready" } & OpenedSession<TNative>);

type Options<TNative> = {
  name: string;
  adapter: ReporterAdapter<TNative>;
  buffer: { capacity: number; maxAge: number };
  dedupe: { window: number; maxKeys: number };
  timeout: number;
  now: () => number;
  currentGeneration: () => number;
  readAmbient: () => AmbientSnapshot;
  /** Brackets the synchronous part of `submit`, so a capture made from inside it can be refused. */
  submitDepth: { enter: () => void; exit: () => void };
  record: (event: RecordedEvent) => void;
  changed: () => void;
};

const TIMED_OUT = Symbol("timed out");

type Answer =
  | { kind: "pending"; promise: PromiseLike<SubmissionResult> }
  | { kind: "result"; result: SubmissionResult };

// Telling a promise from a result reads the answer's `then`, which is adapter
// code too, so it runs where the submission's failures are contained.
const getSubmissionAnswer = (
  answer: SubmissionResult | PromiseLike<SubmissionResult>,
): Answer => {
  if (isPromiseLike(answer)) {
    return { kind: "pending", promise: answer };
  }

  return { kind: "result", result: answer };
};

// What `open` returned is adapter code: its fields are read once, while a
// failure is still a failed start, and never again where nothing contains them.
const getOpenedSession = <TNative>(
  session: ReporterSession<TNative>,
): OpenedSession<TNative> => {
  if (
    typeof session !== "object" ||
    session === null ||
    typeof session.submit !== "function"
  ) {
    throw new FlareError({
      code: "INVALID_ANSWER",
      message: "The adapter's open returned no session with a submit function.",
    });
  }

  return { session, native: session.native, ambient: session.ambient };
};

/**
 * Owns one destination: its session, what it has already been sent, its
 * startup buffer, the deadline of every submission and its disposal.
 * Whatever the adapter does, every entry accepted here is settled exactly
 * once, and a disposed session is never called again.
 */
export class DestinationRuntime<TNative = unknown> {
  #options: Options<TNative>;
  #state = new ValueStore<State<TNative>>(IDLE_DESTINATION_STATUS);
  #dedupe: DedupeIndex;
  #buffer: Buffered[] = [];
  #expiry: ReturnType<typeof setTimeout> | null = null;
  #flights = new Set<Flight>();
  #opening = false;

  constructor(options: Options<TNative>) {
    this.#options = options;
    this.#dedupe = new DedupeIndex(options.dedupe);
  }

  /** What Flare itself reads, so replacing a method on `status` misleads no one else. */
  get currentStatus(): DestinationStatus {
    const current = this.#state.get();

    // The session is private. Observers receive only the public status.
    if (current.state === "ready") {
      return READY_DESTINATION_STATUS;
    }

    return current;
  }

  status: ObservableValue<DestinationStatus> = {
    get: () => this.currentStatus,
    subscribe: this.#state.subscribe,
  };

  get name() {
    return this.#options.name;
  }

  get adapterName() {
    return this.#options.adapter.name;
  }

  get native() {
    const current = this.#state.get();

    if (current.state !== "ready") {
      return null;
    }

    return current.native;
  }

  get buffered() {
    return this.#buffer.length;
  }

  get inFlight() {
    return this.#flights.size;
  }

  /** Opens the adapter. A second call does nothing unless the first `open` threw. */
  start = () => {
    const current = this.#state.get();

    // Called again from inside `open`, which the outer call is still finishing.
    if (this.#opening) {
      return;
    }

    if (current.state === "ready" || current.state === "disposed") {
      return;
    }

    this.#opening = true;

    const opened = this.#open();

    this.#opening = false;

    if (opened.kind === "failed") {
      this.#fail(current, opened.error);

      return;
    }

    if (opened.kind === "opened") {
      this.#ready(current, opened.session);

      return;
    }

    assertUnreachable(opened);
  };

  /** Takes one report, unless this destination was already sent the same occurrence. */
  accept = (entry: Entry, { key, thrown }: Occurrence) => {
    const duplicate = this.#dedupe.isDuplicate({
      generation: entry.report.identity.generation,
      key,
      thrown,
      now: this.#options.now(),
    });

    if (duplicate) {
      this.#settle(entry, { status: "dropped", reason: "deduped" });

      return;
    }

    this.#deliver(entry);
  };

  flush = async (
    timeout: number,
  ): Promise<{ drained: boolean; boundary: DestinationFlushResult }> => {
    const current = this.#state.get();

    if (current.state !== "ready") {
      return { drained: false, boundary: { status: "not-ready" } };
    }

    const controller = new AbortController();
    const expiry = createDeferred<typeof TIMED_OUT>();
    const startedAt = this.#options.now();

    // Referenced, unlike the other timers: its caller is waiting for it.
    const timer = setTimeout(() => {
      controller.abort();
      expiry.resolve(TIMED_OUT);
    }, timeout);

    try {
      // Later submissions are not in this list, so they cannot extend the wait.
      const accepted = [...this.#flights].map((flight) => flight.done.promise);

      const drained = await Promise.race([
        Promise.all(accepted),
        expiry.promise,
      ]);

      if (drained === TIMED_OUT) {
        return { drained: false, boundary: { status: "timeout" } };
      }

      if (this.#state.get() !== current) {
        return { drained: true, boundary: { status: "not-ready" } };
      }

      const { session } = current;

      if (typeof session.flush !== "function") {
        return { drained: true, boundary: { status: "unsupported" } };
      }

      // The provider gets what is left of the deadline, not all of it again.
      const remaining = Math.max(
        0,
        timeout - (this.#options.now() - startedAt),
      );

      const boundary = await Promise.race([
        session.flush({ timeout: remaining, signal: controller.signal }),
        expiry.promise,
      ]);

      if (boundary === TIMED_OUT) {
        return { drained: true, boundary: { status: "timeout" } };
      }

      return { drained: true, boundary: copyFlushResult(boundary) };
    } catch (error) {
      return { drained: true, boundary: { status: "failed", error } };
    } finally {
      clearTimeout(timer);
    }
  };

  syncAmbient = (snapshot: AmbientSnapshot) => {
    const ambient = this.#readyAmbient();

    if (ambient === undefined) {
      return;
    }

    this.#contain("ambient session failed", () => ambient.session(snapshot));
  };

  ambientBreadcrumb = (breadcrumb: Breadcrumb) => {
    const ambient = this.#readyAmbient();

    if (ambient === undefined) {
      return;
    }

    this.#contain("ambient breadcrumb failed", () =>
      ambient.breadcrumb(breadcrumb),
    );
  };

  dispose = () => {
    const current = this.#state.get();

    if (current.state === "disposed") {
      return;
    }

    this.#become(DISPOSED_DESTINATION_STATUS);

    const waiting = this.#buffer.splice(0);

    this.#scheduleExpiry();

    for (const entry of waiting) {
      this.#settle(entry, { status: "dropped", reason: "disposed" });
    }

    for (const flight of [...this.#flights]) {
      flight.controller.abort();
      this.#land(flight, { status: "indeterminate", reason: "disposed" });
    }

    if (current.state === "ready") {
      this.#release(current.session);
    }
  };

  #fail(from: State<TNative>, error: unknown) {
    // Disposed from inside `open`: disposal stands.
    if (this.#state.get() !== from) {
      return;
    }

    // The buffer is kept: a later start() may still deliver it before it expires.
    this.#become({ state: "failed", error });
  }

  #open():
    | { kind: "opened"; session: OpenedSession<TNative> }
    | { kind: "failed"; error: unknown } {
    try {
      return {
        kind: "opened",
        session: getOpenedSession(this.#options.adapter.open()),
      };
    } catch (error) {
      return { kind: "failed", error };
    }
  }

  #ready(from: State<TNative>, opened: OpenedSession<TNative>) {
    // Disposed from inside `open`: this session has no owner.
    if (this.#state.get() !== from) {
      this.#release(opened.session);

      return;
    }

    // An observer that disposes from the ready notification empties the
    // buffer, and every call below checks the state first.
    this.#become({ state: "ready", ...opened });
    this.syncAmbient(this.#options.readAmbient());
    this.#submitBuffered();
  }

  // Oldest first. A report captured while these wait, from the ready
  // notification for example, joins the end instead of overtaking them.
  #submitBuffered() {
    let entry = this.#buffer.shift();

    while (entry !== undefined) {
      const current = this.#state.get();

      if (current.state !== "ready") {
        this.#buffer.unshift(entry);

        break;
      }

      this.#submit(current.session, entry);
      entry = this.#buffer.shift();
    }

    this.#scheduleExpiry();
  }

  #deliver(entry: Entry) {
    const current = this.#state.get();

    if (current.state === "ready" && this.#buffer.length > 0) {
      this.#hold(entry);

      return;
    }

    if (current.state === "ready") {
      this.#submit(current.session, entry);

      return;
    }

    if (current.state === "disposed") {
      this.#settle(entry, { status: "dropped", reason: "disposed" });

      return;
    }

    if (current.state === "idle" || current.state === "failed") {
      this.#hold(entry);

      return;
    }

    assertUnreachable(current);
  }

  #become(state: State<TNative>) {
    this.#state.set(Object.freeze(state));

    // An observer has already moved on: announce only what still stands.
    if (this.#state.get() !== state) {
      return;
    }

    this.#record(`destination ${state.state}`);
    this.#options.changed();
  }

  #readyAmbient() {
    const current = this.#state.get();

    if (current.state !== "ready") {
      return undefined;
    }

    return current.ambient;
  }

  #hold(entry: Entry) {
    this.#buffer.push({ ...entry, acceptedAt: this.#options.now() });

    if (this.#buffer.length > this.#options.buffer.capacity) {
      const pushedOut = this.#buffer.shift();

      if (pushedOut !== undefined) {
        this.#settle(pushedOut, {
          status: "dropped",
          reason: "buffer-overflow",
        });
      }
    }

    this.#record("report buffered", entry.report.id, {
      buffered: this.#buffer.length,
    });
    this.#scheduleExpiry();
    this.#options.changed();
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
    const delay = Math.max(0, oldest.acceptedAt + buffer.maxAge - now());

    this.#expiry = setTimeout(this.#expire, delay);
    unrefTimer(this.#expiry);
  }

  #expire = () => {
    const { now, buffer } = this.#options;
    const outcome = this.#expiredOutcome();
    const time = now();

    // The clock stepped back past these reports: they wait from now instead.
    for (const entry of this.#buffer) {
      if (entry.acceptedAt > time) {
        entry.acceptedAt = time;
      }
    }

    while (this.#buffer.length > 0) {
      const oldest = this.#buffer[0];

      if (oldest === undefined || time - oldest.acceptedAt < buffer.maxAge) {
        break;
      }

      this.#buffer.shift();
      this.#settle(oldest, outcome);
    }

    this.#scheduleExpiry();
    this.#options.changed();
  };

  // A report that outlived the buffer while the destination failed to start
  // was never offered to it, which is not the same as dropping it.
  #expiredOutcome(): DestinationOutcome {
    if (this.#state.get().state === "failed") {
      return { status: "skipped", reason: "start-failed" };
    }

    return { status: "dropped", reason: "buffer-expired" };
  }

  #submit(session: ReporterSession<TNative>, entry: Entry) {
    const { timeout, currentGeneration, submitDepth } = this.#options;
    const controller = new AbortController();

    const flight: Flight = {
      entry,
      controller,
      done: createDeferred<void>(),
      timer: setTimeout(() => {
        controller.abort();
        // The provider may still send it: a deadline proves nothing either way.
        this.#land(flight, { status: "indeterminate", reason: "timeout" });
      }, timeout),
    };

    unrefTimer(flight.timer);
    this.#flights.add(flight);

    this.#record("destination submit", entry.report.id);

    // A diagnostic listener has disposed the destination already.
    if (!this.#flights.has(flight)) {
      return;
    }

    let answer: Answer;

    submitDepth.enter();

    try {
      answer = getSubmissionAnswer(
        session.submit(entry.report, {
          signal: controller.signal,
          currentGeneration,
        }),
      );
    } catch (error) {
      this.#land(flight, { status: "failed", error });

      return;
    } finally {
      submitDepth.exit();
    }

    if (answer.kind === "pending") {
      // It never rejects: every way the answer can fail lands as an outcome.
      this.#landWhenAnswered(flight, answer.promise);

      return;
    }

    if (answer.kind === "result") {
      this.#landAnswer(flight, answer.result);

      return;
    }

    assertUnreachable(answer);
  }

  async #landWhenAnswered(
    flight: Flight,
    answer: PromiseLike<SubmissionResult>,
  ) {
    let result: SubmissionResult;

    try {
      result = await answer;
    } catch (error) {
      this.#land(flight, { status: "failed", error });

      return;
    }

    this.#landAnswer(flight, result);
  }

  // The answer is adapter code too: a field that throws when it is read is a
  // failed submission, never a throw into the application.
  #landAnswer(flight: Flight, result: SubmissionResult) {
    let outcome: DestinationOutcome;

    try {
      outcome = copySubmissionOutcome(result);
    } catch (error) {
      this.#land(flight, { status: "failed", error });

      return;
    }

    this.#land(flight, outcome);
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
    this.#record(
      "destination outcome",
      entry.report.id,
      describeOutcome(outcome),
    );
    this.#options.changed();
  }

  #release(session: ReporterSession<TNative>) {
    this.#contain("destination dispose failed", () => session.dispose?.());
  }

  #contain(type: string, task: () => unknown) {
    try {
      const result = task();

      if (result !== undefined) {
        Promise.resolve(result).catch(() => this.#record(type));
      }
    } catch {
      this.#record(type);
    }
  }

  #record(type: string, report?: string, context?: unknown) {
    this.#options.record({
      source: "destination",
      type,
      destination: this.name,
      report,
      context,
    });
  }
}
