import { describe, expect, test } from "vitest";

import type { ReporterAdapter } from "src/types/ReporterAdapter";
import type { ReporterSession } from "src/types/ReporterSession";
import type { SanitizedReport } from "src/types/SanitizedReport";
import type { SubmissionContext } from "src/types/SubmissionContext";
import type { SubmissionEvidence } from "src/types/SubmissionEvidence";
import { parseSubmissionResult } from "src/utils/internal/destinations/parseSubmissionResult";

export type ReporterConformanceOptions = {
  /** Label for the generated `describe` block. */
  name: string;
  /** Creates a cold adapter over a fake or stubbed provider. Called once per test. */
  createAdapter: () => ReporterAdapter;
};

const EVIDENCE_STRENGTH = {
  "sdk-call-returned": 0,
  "sdk-callback-completed": 1,
  "backend-acknowledged": 2,
} satisfies Record<SubmissionEvidence, number>;

const deepFreeze = <TValue>(value: TValue): TValue => {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }

  return Object.freeze(value);
};

const base = {
  timestamp: 1_767_225_600_000,
  level: "error" as const,
  identity: {
    generation: 1,
    user: { id: "conformance-user", email: "user@example.com" },
  },
  tags: { area: "conformance", attempt: 2, retry: true },
  contexts: { upload: { kind: "avatar", nested: { size: 3 } } },
  breadcrumbs: [
    {
      name: "conformance-step",
      data: { step: 1 },
      timestamp: 1_767_225_599_000,
    },
  ],
  operation: "conformance-operation",
  losses: [],
};

const exceptionReport = (): SanitizedReport =>
  deepFreeze({
    ...base,
    id: "conformance-exception",
    kind: "exception",
    exception: {
      origin: "error",
      name: "ConformanceError",
      message: "conformance exception",
      stack:
        "ConformanceError: conformance exception\n    at conformance (conformance.ts:1:1)",
      causes: [{ name: "Error", message: "conformance cause", stack: null }],
      aggregated: [],
    },
  });

const messageReport = (): SanitizedReport =>
  deepFreeze({
    ...base,
    id: "conformance-message",
    level: "warning",
    kind: "message",
    message: "conformance message",
  });

const submissionContext = (): SubmissionContext => ({
  signal: new AbortController().signal,
  currentGeneration: () => 1,
});

const settled = async (run: () => unknown) => {
  try {
    return { value: await run(), threw: false };
  } catch {
    return { value: undefined, threw: true };
  }
};

/**
 * Registers the contract every reporter adapter must keep. Call it at the top
 * level of `src/conformance.test.ts`, over a fake or a stubbed provider SDK.
 *
 * It checks only what is provider independent: a valid cold description,
 * capabilities that match the session's methods, a stable native handle,
 * untouched input, valid results whose evidence is no stronger than declared,
 * and an idempotent lifecycle that refuses work after disposal.
 *
 * It cannot check that the factory is cold, that `open` rolls back when the
 * provider fails to start, or how each field is mapped. Keep those in the
 * adapter's own tests. Deadlines are owned by the core and tested there.
 *
 * @example
 * ```ts
 * testReporterAdapter({
 *   name: "console",
 *   createAdapter: () => consoleReporter({ writer: () => {} }),
 * });
 * ```
 */
export const testReporterAdapter = ({
  name,
  createAdapter,
}: ReporterConformanceOptions) => {
  const open = async (): Promise<ReporterSession | null> => {
    const adapter = createAdapter();

    if (!adapter.available().available) {
      return null;
    }

    return adapter.open({ destination: "conformance" });
  };

  describe(`${name} adapter conformance`, () => {
    test("the adapter describes itself without opening anything", () => {
      const adapter = createAdapter();
      const availability = adapter.available();

      expect(typeof adapter.name).toBe("string");
      expect(adapter.name).not.toBe("");
      expect(typeof adapter.open).toBe("function");
      expect(Object.keys(EVIDENCE_STRENGTH)).toContain(
        adapter.capabilities.evidence,
      );
      expect([
        "none",
        "sdk-queue",
        "native-handoff",
        "backend-acknowledged",
      ]).toContain(adapter.capabilities.flush);
      expect(["none", "sdk-memory", "sdk-persistent"]).toContain(
        adapter.capabilities.queue,
      );
      expect(["none", "provider-owned"]).toContain(
        adapter.capabilities.automaticCapture,
      );
      expect(["singleton", "instance"]).toContain(
        adapter.capabilities.instance,
      );
      expect(["none", "provider-hooks"]).toContain(
        adapter.capabilities.filtering,
      );
      expect(typeof adapter.capabilities.messages).toBe("boolean");

      for (const field of [
        "user",
        "tags",
        "contexts",
        "breadcrumbs",
      ] as const) {
        expect(typeof adapter.capabilities.eventLocal[field]).toBe("boolean");
      }

      if (!availability.available) {
        expect(typeof availability.reason).toBe("string");
      }
    });

    test("a singleton adapter names the SDK it drives, and an instance adapter names none", () => {
      const adapter = createAdapter();

      expect(
        typeof adapter.singleton === "object" && adapter.singleton !== null,
      ).toBe(adapter.capabilities.instance === "singleton");
    });

    test("capabilities match the methods the session has", async () => {
      const session = await open();

      if (session === null) {
        return;
      }

      const { capabilities } = createAdapter();

      expect(typeof session.submit).toBe("function");
      expect(typeof session.dispose).toBe("function");
      expect(typeof session.flush === "function").toBe(
        capabilities.flush !== "none",
      );
      await session.dispose();
    });

    test("the native handle keeps its identity across reads", async () => {
      const session = await open();

      if (session === null) {
        return;
      }

      expect(session.native).toBe(session.native);
      await session.dispose();
    });

    test("an exception is answered with a valid result and the report is left untouched", async () => {
      const session = await open();

      if (session === null) {
        return;
      }

      const report = exceptionReport();
      const before = JSON.stringify(report);

      const result = parseSubmissionResult(
        await session.submit(report, submissionContext()),
      );

      expect(result).not.toBeNull();
      expect(result?.status).not.toBe("failed");
      expect(JSON.stringify(report)).toBe(before);
      await session.dispose();
    });

    test("evidence is never stronger than the capabilities declare", async () => {
      const session = await open();

      if (session === null) {
        return;
      }

      const { capabilities } = createAdapter();

      const result = parseSubmissionResult(
        await session.submit(exceptionReport(), submissionContext()),
      );

      if (result?.status === "submitted") {
        expect(EVIDENCE_STRENGTH[result.evidence]).toBeLessThanOrEqual(
          EVIDENCE_STRENGTH[capabilities.evidence],
        );
      }

      await session.dispose();
    });

    test("a message is sent as a message, or honestly skipped, never reported as a fake Error", async () => {
      const session = await open();

      if (session === null) {
        return;
      }

      const { capabilities } = createAdapter();
      const report = messageReport();
      const before = JSON.stringify(report);

      const result = parseSubmissionResult(
        await session.submit(report, submissionContext()),
      );

      expect(result).not.toBeNull();
      expect(JSON.stringify(report)).toBe(before);

      if (!capabilities.messages) {
        expect(result).toEqual({
          status: "skipped",
          reason: "unsupported-report-kind",
        });
      }

      await session.dispose();
    });

    test("flush, where supported, answers with a valid result", async () => {
      const session = await open();

      if (session === null || typeof session.flush !== "function") {
        return;
      }

      const result = await session.flush({
        timeoutMs: 1_000,
        signal: new AbortController().signal,
      });

      expect(["flushed", "timeout", "failed"]).toContain(result.status);
      await session.dispose();
    });

    test("disposal is idempotent", async () => {
      const session = await open();

      if (session === null) {
        return;
      }

      await session.dispose();

      expect((await settled(() => session.dispose())).threw).toBe(false);
    });

    test("submit and flush are refused after disposal, and ambient calls are silent", async () => {
      const session = await open();

      if (session === null) {
        return;
      }

      await session.dispose();

      const submitted = await settled(() =>
        session.submit(exceptionReport(), submissionContext()),
      );

      expect(submitted.threw).toBe(true);

      const { flush, ambient } = session;

      if (typeof flush === "function") {
        const flushed = await settled(() =>
          flush({ timeoutMs: 100, signal: new AbortController().signal }),
        );

        expect(flushed.threw).toBe(true);
      }

      const snapshot = { generation: 2, user: null, tags: {}, contexts: {} };
      const crumb = { name: "after-dispose", data: null, timestamp: 1 };

      expect(() => {
        ambient?.session?.(snapshot);
        ambient?.breadcrumb?.(crumb);
      }).not.toThrow();
    });

    test("every open yields an independent session", async () => {
      const adapter = createAdapter();

      if (!adapter.available().available) {
        return;
      }

      const first = await adapter.open({ destination: "conformance" });

      await first.dispose();

      const second = await adapter.open({ destination: "conformance" });

      const result = parseSubmissionResult(
        await second.submit(exceptionReport(), submissionContext()),
      );

      expect(result).not.toBeNull();
      await second.dispose();
    });
  });
};
