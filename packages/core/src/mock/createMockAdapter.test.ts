import { expect, test } from "vitest";

import { createMockAdapter } from "src/mock/createMockAdapter";
import type { SanitizedReport } from "src/types/SanitizedReport";
import type { SubmissionContext } from "src/types/SubmissionContext";

const report: SanitizedReport = {
  id: "report-1",
  timestamp: 1,
  level: "info",
  identity: { generation: 0, user: null },
  tags: {},
  contexts: {},
  breadcrumbs: [],
  operation: null,
  losses: [],
  kind: "message",
  message: "hello",
};

const context: SubmissionContext = {
  signal: new AbortController().signal,
  currentGeneration: () => 0,
};

test("creating the mock opens nothing", () => {
  const mock = createMockAdapter();

  expect(mock.sessions).toEqual([]);
});

test("by default a submission is recorded and answered at once", () => {
  const mock = createMockAdapter();
  const session = mock.adapter.open();

  expect(session.submit(report, context)).toEqual({
    status: "submitted",
    evidence: "sdk-call-returned",
    event: null,
    losses: [],
  });
  expect(mock.submissions.map((submission) => submission.report)).toEqual([
    report,
  ]);
});

test("a held submission waits for the test to answer it", async () => {
  const mock = createMockAdapter({ hold: true });
  const session = mock.adapter.open();

  const pending = session.submit(report, context);

  mock.submissions[0]?.settle({ status: "indeterminate", reason: "ambiguous" });

  await expect(pending).resolves.toEqual({
    status: "indeterminate",
    reason: "ambiguous",
  });
});

test("a held submission can be failed like a rejecting provider", async () => {
  const mock = createMockAdapter({ hold: true });
  const session = mock.adapter.open();
  const failure = new Error("network down");

  const pending = session.submit(report, context);

  mock.submissions[0]?.fail(failure);

  await expect(pending).rejects.toBe(failure);
});

test("a submit hook can throw like a synchronous provider failure, or answer", () => {
  const failure = new Error("sdk threw");

  const throwing = createMockAdapter({
    onSubmit: () => {
      throw failure;
    },
  });

  const answering = createMockAdapter({
    onSubmit: () => ({ status: "dropped", reason: "provider-filtered" }),
  });

  const throwingSession = throwing.adapter.open();
  const answeringSession = answering.adapter.open();

  expect(() => throwingSession.submit(report, context)).toThrow(failure);
  expect(answeringSession.submit(report, context)).toEqual({
    status: "dropped",
    reason: "provider-filtered",
  });
});

test("an open hook can throw like a provider that fails to start", () => {
  const failure = new Error("native module missing");

  const mock = createMockAdapter({
    onOpen: () => {
      throw failure;
    },
  });

  expect(() => mock.adapter.open()).toThrow(failure);
  expect(mock.sessions).toEqual([]);
});

test("flush and ambient exist only when asked for", () => {
  const bare = createMockAdapter().adapter.open();
  const full = createMockAdapter({ flush: true, ambient: true }).adapter.open();

  expect("flush" in bare).toBe(false);
  expect("ambient" in bare).toBe(false);
  expect(typeof full.flush).toBe("function");
  expect(typeof full.ambient?.session).toBe("function");
});

test("ambient calls are recorded", () => {
  const mock = createMockAdapter({ ambient: true });
  const session = mock.adapter.open();
  const snapshot = { generation: 1, user: null, tags: {}, contexts: {} };
  const crumb = { name: "opened", data: null, timestamp: 1 };

  session.ambient?.session(snapshot);
  session.ambient?.breadcrumb(crumb);

  expect(mock.sessions[0]?.ambient).toEqual({
    sessions: [snapshot],
    breadcrumbs: [crumb],
  });
});

test("the mock never guards itself, so tests can act after disposal", async () => {
  const mock = createMockAdapter();
  const session = mock.adapter.open();

  await session.dispose?.();
  await session.dispose?.();
  session.submit(report, context);

  expect(mock.sessions[0]?.disposeCount).toBe(2);
  expect(mock.submissions).toHaveLength(1);
});
