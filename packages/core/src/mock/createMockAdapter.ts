import type { AmbientSnapshot } from "src/types/AmbientSnapshot";
import type { Breadcrumb } from "src/types/Breadcrumb";
import type { FlushContext } from "src/types/FlushContext";
import type { FlushResult } from "src/types/FlushResult";
import type { ReporterAdapter } from "src/types/ReporterAdapter";
import type { ReporterSession } from "src/types/ReporterSession";
import type { SanitizedReport } from "src/types/SanitizedReport";
import type { SubmissionContext } from "src/types/SubmissionContext";
import type { SubmissionResult } from "src/types/SubmissionResult";
import { createDeferred } from "src/utils/common/createDeferred";

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

export type MockAdapterOptions = {
  name?: string;
  /** `submit` returns a promise the test answers through `submissions`. */
  hold?: boolean;
  /** Whether a session has `flush`. `"hold"` returns a promise the test answers. */
  flush?: boolean | "hold";
  /** Whether a session has an ambient integration. */
  ambient?: boolean;
  /** Runs inside `open`. Throwing stands for a provider that fails to initialize. */
  onOpen?: () => void;
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
 * never times out, so a test can drive failed starts and held, late, failed
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
  const sessions: MockSession[] = [];
  const submissions: MockSubmission[] = [];
  const hasFlush = options.flush === true || options.flush === "hold";

  const open = (): ReporterSession<MockSession> => {
    // A throwing hook means the provider never started, so nothing is recorded.
    if (typeof options.onOpen === "function") {
      options.onOpen();
    }

    const record: MockSession = {
      submissions: [],
      flushes: [],
      ambient: { sessions: [], breadcrumbs: [] },
      disposeCount: 0,
    };

    sessions.push(record);

    const submit: ReporterSession["submit"] = (report, context) => {
      const answer = createDeferred<SubmissionResult>();

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
      const answer = createDeferred<FlushResult>();

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

    const session: ReporterSession<MockSession> = {
      native: record,
      submit,
      dispose: () => {
        record.disposeCount += 1;
      },
    };

    if (hasFlush) {
      session.flush = flush;
    }

    if (options.ambient === true) {
      session.ambient = {
        session: (snapshot) => {
          record.ambient.sessions.push(snapshot);
        },
        breadcrumb: (breadcrumb) => {
          record.ambient.breadcrumbs.push(breadcrumb);
        },
      };
    }

    return session;
  };

  const adapter: ReporterAdapter<MockSession> = {
    name: options.name ?? "mock",
    open,
  };

  return { adapter, sessions, submissions };
};
