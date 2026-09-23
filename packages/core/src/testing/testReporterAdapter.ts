import { describe, expect, test } from "vitest";

import { createMockAdapter } from "src/mock/createMockAdapter";
import type { ReporterAdapter } from "src/types/ReporterAdapter";
import type { SubmissionContext } from "src/types/SubmissionContext";
import { Flare } from "src/utils/Flare";

export type ReporterConformanceOptions = {
  /** Label for the generated `describe` block. */
  name: string;
  /**
   * Creates a cold adapter over a fake or stubbed provider. Called once per
   * test. The reports belong to the user `conformance-user`, so a provider
   * that attaches a user of its own should attach that one.
   */
  createAdapter: () => ReporterAdapter;
};

class ConformanceError extends Error {
  override name = "ConformanceError";
}

// Built by a real Flare, so an adapter meets the data the core produces: the
// objects it builds, frozen and sanitized, and never a hand-written stand-in.
const captureFixtures = () => {
  const mock = createMockAdapter({ ambient: true });
  const flare = new Flare({ destinations: { conformance: mock.adapter } });

  flare.start();
  flare.user({ id: "conformance-user", email: "user@example.com" });
  flare.tag("area", "conformance");
  flare.context("upload", { kind: "avatar", nested: { size: 3 } });
  flare.breadcrumb("conformance-step", { step: 1 });

  const options = {
    tags: { attempt: 2, retry: true },
    operation: "conformance-operation",
  };

  flare.capture(
    new ConformanceError("conformance exception", {
      cause: new Error("conformance cause"),
    }),
    options,
  );
  flare.message("conformance message", { ...options, level: "warning" });
  flare.dispose();

  const exception = mock.submissions[0]?.report;
  const message = mock.submissions[1]?.report;
  const snapshot = mock.sessions[0]?.ambient.sessions.at(-1);
  const breadcrumb = mock.sessions[0]?.ambient.breadcrumbs.at(-1);

  if (
    exception === undefined ||
    message === undefined ||
    snapshot === undefined ||
    breadcrumb === undefined
  ) {
    throw new Error("The conformance fixtures were not captured.");
  }

  return { exception, message, snapshot, breadcrumb };
};

const submissionContext = (): SubmissionContext => ({
  signal: new AbortController().signal,
  currentGeneration: () => 1,
});

/**
 * Registers the contract every reporter adapter must keep. Call it at the top
 * level of `src/conformance.test.ts`, over a fake or a stubbed provider SDK.
 * The reports, snapshot and breadcrumb it hands over are built by a real
 * Flare, exactly as the core produces them.
 *
 * It checks only what is provider independent: a named description, a
 * stable native handle, untouched input, reports that are answered without
 * failing and messages that are sent or honestly skipped, a flush and an
 * ambient integration that answer, disposal that completes, and an
 * independent session per `open`.
 *
 * It cannot check that the factory is cold or how each field is mapped. Keep
 * those in the adapter's own tests. Deadlines and the lifecycle around a
 * session are owned by the core and tested there.
 *
 * @example
 * ```ts
 * testReporterAdapter({
 *   name: "console",
 *   createAdapter: () => console({ writer: () => {} }),
 * });
 * ```
 */
export const testReporterAdapter = ({
  name,
  createAdapter,
}: ReporterConformanceOptions) => {
  describe(`${name} adapter conformance`, () => {
    test("the adapter names itself and opens on demand", () => {
      const adapter = createAdapter();

      expect(typeof adapter.name).toBe("string");
      expect(adapter.name).not.toBe("");
      expect(typeof adapter.open).toBe("function");
    });

    test("the native handle keeps its identity across reads", async () => {
      const session = createAdapter().open();

      expect(session.native).toBe(session.native);
      await session.dispose?.();
    });

    test("an exception is answered without failing and the report is left untouched", async () => {
      const session = createAdapter().open();
      const report = captureFixtures().exception;
      const before = JSON.stringify(report);

      const result = await session.submit(report, submissionContext());

      expect(result.status).not.toBe("failed");
      expect(JSON.stringify(report)).toBe(before);
      await session.dispose?.();
    });

    test("a message is submitted as a message or skipped as unsupported, and the report is left untouched", async () => {
      const session = createAdapter().open();
      const report = captureFixtures().message;
      const before = JSON.stringify(report);

      const result = await session.submit(report, submissionContext());

      await session.dispose?.();

      expect(JSON.stringify(report)).toBe(before);

      if (result.status === "skipped") {
        expect(result.reason).toBe("unsupported-report-kind");

        return;
      }

      expect(result.status).toBe("submitted");
    });

    test("flush, where there is one, answers flushed, timeout or failed", async () => {
      const session = createAdapter().open();

      if (typeof session.flush !== "function") {
        await session.dispose?.();

        return;
      }

      const result = await session.flush({
        timeout: 1_000,
        signal: new AbortController().signal,
      });

      expect(["flushed", "timeout", "failed"]).toContain(result.status);
      await session.dispose?.();
    });

    test("an ambient integration, where there is one, takes a session snapshot and a breadcrumb", async () => {
      const session = createAdapter().open();
      const { snapshot, breadcrumb } = captureFixtures();

      expect(() => {
        session.ambient?.session(snapshot);
        session.ambient?.breadcrumb(breadcrumb);
      }).not.toThrow();
      await session.dispose?.();
    });

    test("disposal, where there is one, completes", async () => {
      const session = createAdapter().open();

      await expect(
        Promise.resolve(session.dispose?.()),
      ).resolves.toBeUndefined();
    });

    test("every open yields an independent session", async () => {
      const adapter = createAdapter();
      const first = adapter.open();

      await first.dispose?.();

      const second = adapter.open();

      const result = await second.submit(
        captureFixtures().exception,
        submissionContext(),
      );

      expect(result.status).not.toBe("failed");
      await second.dispose?.();
    });
  });
};
