import { expect, test, vi } from "vitest";

import { createReporterAdapter } from "src/generators/createReporterAdapter";
import type { ReporterAdapterDefinition } from "src/types/ReporterAdapterDefinition";
import type { ReporterCapabilities } from "src/types/ReporterCapabilities";
import type { ReporterSession } from "src/types/ReporterSession";
import type { SanitizedReport } from "src/types/SanitizedReport";
import type { SubmissionContext } from "src/types/SubmissionContext";
import { deferred } from "src/utils/common/deferred";

const capabilities: ReporterCapabilities = {
  eventLocal: { user: true, tags: true, contexts: true, breadcrumbs: true },
  messages: true,
  evidence: "sdk-call-returned",
  flush: "none",
  queue: "none",
  automaticCapture: "none",
  instance: "instance",
  filtering: "none",
};

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

const openContext = { destination: "test" };

const sessionOf = (
  overrides: Partial<ReporterSession<{ sdk: true }>> = {},
): ReporterSession<{ sdk: true }> => ({
  native: { sdk: true },
  submit: () => ({
    status: "submitted",
    evidence: "sdk-call-returned",
    event: null,
    losses: [],
  }),
  dispose: () => {},
  ...overrides,
});

const adapterOf = (
  open: ReporterAdapterDefinition<{ sdk: true }>["open"],
  overrides: Partial<ReporterAdapterDefinition<{ sdk: true }>> = {},
) =>
  createReporterAdapter<{ sdk: true }>({
    name: "test",
    capabilities,
    available: () => ({ available: true }),
    open,
    ...overrides,
  });

test("name and capabilities pass through and creating the adapter opens nothing", () => {
  const open = vi.fn(() => sessionOf());

  const adapter = adapterOf(open);

  expect(adapter.name).toBe("test");
  expect(adapter.capabilities).toBe(capabilities);
  expect(open).not.toHaveBeenCalled();
});

test("the singleton a definition declares passes through, and stays absent otherwise", () => {
  const sdk = { name: "process-wide sdk" };

  expect(adapterOf(() => sessionOf(), { singleton: sdk }).singleton).toBe(sdk);
  expect("singleton" in adapterOf(() => sessionOf())).toBe(false);
});

test("the native handle keeps its identity", async () => {
  const session = sessionOf();

  const opened = await adapterOf(() => session).open(openContext);

  expect(opened.native).toBe(session.native);
});

test("disposal reaches the session once, however often it is called", async () => {
  const dispose = vi.fn();
  const opened = await adapterOf(() => sessionOf({ dispose })).open(
    openContext,
  );

  await opened.dispose();
  await opened.dispose();
  await opened.dispose();

  expect(dispose).toHaveBeenCalledTimes(1);
});

test("submitting through a disposed session is refused by name", async () => {
  const submit = vi.fn(sessionOf().submit);
  const opened = await adapterOf(() => sessionOf({ submit })).open(openContext);
  await opened.dispose();

  expect(() => opened.submit(report, context)).toThrow(
    "Cannot submit through a disposed test session.",
  );
  expect(submit).not.toHaveBeenCalled();
});

test("optional members stay absent when the session does not provide them", async () => {
  const opened = await adapterOf(() => sessionOf()).open(openContext);

  expect("flush" in opened).toBe(false);
  expect("ambient" in opened).toBe(false);
});

test("flush is forwarded while open and refused after disposal", async () => {
  const flush = vi.fn(() => ({ status: "flushed" as const }));
  const opened = await adapterOf(() => sessionOf({ flush })).open(openContext);
  const flushContext = { timeoutMs: 100, signal: new AbortController().signal };

  expect(opened.flush?.(flushContext)).toEqual({ status: "flushed" });

  await opened.dispose();

  expect(() => opened.flush?.(flushContext)).toThrow(
    "Cannot flush a disposed test session.",
  );
});

test("ambient calls are forwarded while open and silent after disposal", async () => {
  const session = vi.fn();
  const breadcrumb = vi.fn();
  const opened = await adapterOf(() =>
    sessionOf({ ambient: { session, breadcrumb } }),
  ).open(openContext);
  const snapshot = { generation: 1, user: null, tags: {}, contexts: {} };
  const crumb = { name: "opened", data: null, timestamp: 1 };

  opened.ambient?.session?.(snapshot);
  await opened.dispose();
  opened.ambient?.session?.(snapshot);
  opened.ambient?.breadcrumb?.(crumb);

  expect(session).toHaveBeenCalledTimes(1);
  expect(breadcrumb).not.toHaveBeenCalled();
});

test("an ambient integration keeps only the methods the session has", async () => {
  const opened = await adapterOf(() =>
    sessionOf({ ambient: { session: () => {} } }),
  ).open(openContext);

  expect(typeof opened.ambient?.session).toBe("function");
  expect("breadcrumb" in (opened.ambient ?? {})).toBe(false);
});

test("an open that throws rolls back what it had registered, newest first", async () => {
  const released: string[] = [];
  const failure = new Error("sdk init failed");
  const adapter = adapterOf((_context, lifetime) => {
    lifetime.add(() => released.push("first"));
    lifetime.add(() => released.push("second"));
    throw failure;
  });

  await expect(
    Promise.resolve().then(() => adapter.open(openContext)),
  ).rejects.toBe(failure);
  expect(released).toEqual(["second", "first"]);
});

test("an open that rejects rolls back the same way", async () => {
  const released: string[] = [];
  const failure = new Error("sdk init rejected");
  const adapter = adapterOf(async (_context, lifetime) => {
    lifetime.add(() => released.push("listener"));
    throw failure;
  });

  await expect(adapter.open(openContext)).rejects.toBe(failure);
  expect(released).toEqual(["listener"]);
});

test.each([false, true])(
  "a session that cannot be wrapped rolls back after asynchronous open %s",
  async (asynchronous) => {
    const cleanup = vi.fn();
    const failure = new Error("cannot read flush");
    const adapter = adapterOf((_context, lifetime) => {
      lifetime.add(cleanup);
      const session = {
        ...sessionOf(),
        get flush(): never {
          throw failure;
        },
      };
      return asynchronous ? Promise.resolve(session) : session;
    });

    await expect(
      Promise.resolve().then(() => adapter.open(openContext)),
    ).rejects.toBe(failure);
    expect(cleanup).toHaveBeenCalledTimes(1);
  },
);

test("a rollback that fails too reports both failures together", async () => {
  const failure = new Error("sdk init failed");
  const cleanupFailure = new Error("cleanup failed");
  const adapter = adapterOf((_context, lifetime) => {
    lifetime.add(() => {
      throw cleanupFailure;
    });
    throw failure;
  });

  await expect(
    Promise.resolve().then(() => adapter.open(openContext)),
  ).rejects.toMatchObject({ errors: [failure, cleanupFailure] });
});

test("disposal releases the session and then every registered cleanup, even when some throw", async () => {
  const order: string[] = [];
  const sessionFailure = new Error("session dispose failed");
  const cleanupFailure = new Error("cleanup failed");
  const opened = await adapterOf((_context, lifetime) => {
    lifetime.add(() => order.push("first cleanup"));
    lifetime.add(() => {
      order.push("second cleanup");
      throw cleanupFailure;
    });
    return sessionOf({
      dispose: () => {
        order.push("session");
        throw sessionFailure;
      },
    });
  }).open(openContext);

  await expect(Promise.resolve().then(opened.dispose)).rejects.toMatchObject({
    message: "test cleanup failed.",
    errors: [sessionFailure, cleanupFailure],
  });
  expect(order).toEqual(["session", "second cleanup", "first cleanup"]);
});

test("an asynchronous session disposal is awaited and its failure is reported", async () => {
  const failure = new Error("close rejected");
  const opened = await adapterOf(() =>
    sessionOf({ dispose: () => Promise.reject(failure) }),
  ).open(openContext);

  await expect(opened.dispose()).rejects.toBe(failure);
});

test("concurrent and reentrant disposal share cleanup and preserve every failure", async () => {
  const closing = deferred<void>();
  const order: string[] = [];
  const sessionFailure = new Error("session failed");
  const cleanupFailure = new Error("cleanup failed");
  const opened = await adapterOf((_context, lifetime) => {
    lifetime.add(() => order.push("first"));
    lifetime.add(() => {
      order.push("second");
      throw cleanupFailure;
    });
    return sessionOf({
      dispose: () => {
        order.push("session");
        expect(opened.dispose()).toBeUndefined();
        return closing.promise;
      },
    });
  }).open(openContext);

  const first = opened.dispose();
  expect(opened.dispose()).toBe(first);
  expect(order).toEqual(["session"]);
  const rejected = expect(first).rejects.toMatchObject({
    errors: [sessionFailure, cleanupFailure],
  });
  closing.reject(sessionFailure);
  await rejected;

  expect(order).toEqual(["session", "second", "first"]);
  expect(opened.dispose()).toBe(first);
});

test("an availability probe that throws means unavailable, with the reason", () => {
  const adapter = adapterOf(() => sessionOf(), {
    available: () => {
      throw new Error("native module missing");
    },
  });

  expect(adapter.available()).toEqual({
    available: false,
    reason: "native module missing",
  });
});

test("a mapping needs no availability probe or empty disposal callback", async () => {
  const cleanup = vi.fn();
  const adapter = createReporterAdapter({
    name: "minimal",
    capabilities,
    open: (_context, lifetime) => {
      lifetime.add(cleanup);
      return {
        native: "native",
        submit: () => ({ status: "submitted", evidence: "sdk-call-returned" }),
      };
    },
  });

  expect(adapter.available()).toEqual({ available: true });
  const session = await adapter.open(openContext);
  expect(session.native).toBe("native");
  expect(session.submit(report, context)).toMatchObject({
    status: "submitted",
  });
  expect(session.dispose()).toBeUndefined();
  session.dispose();
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(() => session.submit(report, context)).toThrow("disposed minimal");
});

test("forwarded session and ambient methods keep their receiver", async () => {
  const snapshots: unknown[] = [];
  const session = sessionOf({
    flush() {
      expect(this.native).toEqual({ sdk: true });
      return { status: "flushed" };
    },
    ambient: {
      session(snapshot) {
        expect(this.breadcrumb).toBeTypeOf("function");
        snapshots.push(snapshot);
      },
      breadcrumb() {
        expect(this.session).toBeTypeOf("function");
      },
    },
  });
  const opened = await adapterOf(() => session).open(openContext);
  expect(opened.flush?.({ timeoutMs: 100, signal: context.signal })).toEqual({
    status: "flushed",
  });
  const snapshot = { generation: 0, user: null, tags: {}, contexts: {} };
  opened.ambient?.session?.(snapshot);
  opened.ambient?.breadcrumb?.({ name: "opened", data: null, timestamp: 1 });
  expect(snapshots).toEqual([snapshot]);
});
