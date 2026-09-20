import type { AmbientSnapshot } from "src/types/AmbientSnapshot";
import type { Breadcrumb } from "src/types/Breadcrumb";
import type { FlushContext } from "src/types/FlushContext";
import type { FlushResult } from "src/types/FlushResult";
import type { ReporterAdapter } from "src/types/ReporterAdapter";
import type { ReporterAvailability } from "src/types/ReporterAvailability";
import type { ReporterCapabilities } from "src/types/ReporterCapabilities";
import type { ReporterOpenContext } from "src/types/ReporterOpenContext";
import type { ReporterSession } from "src/types/ReporterSession";
import type { SanitizedReport } from "src/types/SanitizedReport";
import type { SubmissionContext } from "src/types/SubmissionContext";
import type { SubmissionResult } from "src/types/SubmissionResult";
import { deferred } from "src/utils/common/deferred";

/** One `submit` call. `settle` and `fail` answer it when the mock holds submissions. */
export type MockSubmission = {
  /** The frozen report exactly as the destination received it. */
  report: SanitizedReport;
  context: SubmissionContext;
  settle: (result?: SubmissionResult) => void;
  fail: (error: unknown) => void;
};

/** One `flush` call. */
export type MockFlush = {
  context: FlushContext;
  settle: (result?: FlushResult) => void;
  fail: (error: unknown) => void;
};

/** One opened session. It is also the session's `native` handle. */
export type MockSession = {
  submissions: MockSubmission[];
  flushes: MockFlush[];
  ambient: { sessions: AmbientSnapshot[]; breadcrumbs: Breadcrumb[] };
  disposeCount: number;
};

/** One `open` call. `settle` and `fail` answer it when the mock holds opening. */
export type MockOpening = {
  context: ReporterOpenContext;
  settle: () => void;
  fail: (error: unknown) => void;
};

export type MockAdapterOptions = {
  name?: string;
  /** Merged over capabilities that match the other options. */
  capabilities?: Partial<ReporterCapabilities>;
  available?: ReporterAvailability;
  /** `open` returns a promise the test answers through `openings`. */
  holdOpen?: boolean;
  /** `submit` returns a promise the test answers through `submissions`. */
  hold?: boolean;
  /** Whether a session has `flush`. `"hold"` returns a promise the test answers. */
  flush?: boolean | "hold";
  /** Whether a session has an ambient integration. */
  ambient?: boolean;
  /** Runs inside `open`. Throwing stands for a provider that fails to initialize. */
  onOpen?: (opening: MockOpening) => void;
  /** Runs inside `submit`. Throwing stands for an SDK that throws; a returned result answers at once. */
  onSubmit?: (submission: MockSubmission) => SubmissionResult | void;
};

const SUBMITTED: SubmissionResult = {
  status: "submitted",
  evidence: "sdk-call-returned",
  event: null,
  losses: [],
};

/**
 * Deterministic reporter adapter for tests. It records every call and is
 * deliberately not well behaved: it never guards itself after disposal and
 * never times out, so a test can drive delayed startup, held, late, failed
 * and hanging submissions exactly where a provider would produce them.
 *
 * @example
 * ```ts
 * const mock = createMockAdapter({ hold: true });
 * const flare = new Flare({ destinations: { mock: mock.adapter } });
 * flare.start();
 * const receipt = flare.capture(new Error("boom"));
 * mock.submissions[0]?.settle();
 * await receipt.settled;
 * ```
 */
export const createMockAdapter = (options: MockAdapterOptions = {}) => {
  const openings: MockOpening[] = [];
  const sessions: MockSession[] = [];
  const submissions: MockSubmission[] = [];

  const capabilities: ReporterCapabilities = {
    eventLocal: { user: true, tags: true, contexts: true, breadcrumbs: true },
    messages: true,
    evidence: "sdk-call-returned",
    flush:
      options.flush === undefined || options.flush === false
        ? "none"
        : "sdk-queue",
    queue: "none",
    automaticCapture: "none",
    instance: "instance",
    filtering: "none",
    ...options.capabilities,
  };

  const createSession = (): ReporterSession<MockSession> => {
    const record: MockSession = {
      submissions: [],
      flushes: [],
      ambient: { sessions: [], breadcrumbs: [] },
      disposeCount: 0,
    };
    sessions.push(record);

    const submit: ReporterSession["submit"] = (report, context) => {
      const answer = deferred<SubmissionResult>();
      const submission: MockSubmission = {
        report,
        context,
        settle: (result = SUBMITTED) => answer.resolve(result),
        fail: answer.reject,
      };
      record.submissions.push(submission);
      submissions.push(submission);

      if (typeof options.onSubmit === "function") {
        const answered = options.onSubmit(submission);
        if (answered !== undefined) {
          return answered;
        }
      }

      if (options.hold === true) {
        return answer.promise;
      }
      return SUBMITTED;
    };

    const flush: NonNullable<ReporterSession["flush"]> = (context) => {
      const answer = deferred<FlushResult>();
      record.flushes.push({
        context,
        settle: (result = { status: "flushed" }) => answer.resolve(result),
        fail: answer.reject,
      });

      if (options.flush === "hold") {
        return answer.promise;
      }
      return { status: "flushed" };
    };

    return {
      native: record,
      submit,
      ...(options.flush === undefined || options.flush === false
        ? {}
        : { flush }),
      ...(options.ambient !== true
        ? {}
        : {
            ambient: {
              session: (snapshot) => {
                record.ambient.sessions.push(snapshot);
              },
              breadcrumb: (breadcrumb) => {
                record.ambient.breadcrumbs.push(breadcrumb);
              },
            },
          }),
      dispose: () => {
        record.disposeCount += 1;
      },
    };
  };

  const adapter: ReporterAdapter<MockSession> = {
    name: options.name ?? "mock",
    capabilities,
    available: () => options.available ?? { available: true },
    open: (context) => {
      const answer = deferred<ReporterSession<MockSession>>();
      const opening: MockOpening = {
        context,
        settle: () => answer.resolve(createSession()),
        fail: answer.reject,
      };

      // A throwing hook means the provider never started, so nothing stays recorded.
      if (typeof options.onOpen === "function") {
        options.onOpen(opening);
      }
      openings.push(opening);

      if (options.holdOpen === true) {
        return answer.promise;
      }
      return createSession();
    },
  };

  return { adapter, openings, sessions, submissions };
};
