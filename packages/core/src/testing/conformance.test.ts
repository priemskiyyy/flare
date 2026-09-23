import { createReporterAdapter } from "src/generators/createReporterAdapter";
import { testReporterAdapter } from "src/testing/testReporterAdapter";
import type { ReporterCapabilities } from "src/types/ReporterCapabilities";

const capabilities: ReporterCapabilities = {
  eventLocal: { user: true, tags: true, contexts: true, breadcrumbs: true },
  messages: true,
  evidence: "sdk-call-returned",
  flush: "sdk-queue",
  queue: "sdk-memory",
  automaticCapture: "none",
  instance: "instance",
  filtering: "none",
};

// The suite is run against the two shapes every adapter takes: one with every
// optional member, and one with none of them.
testReporterAdapter({
  name: "full",
  createAdapter: () =>
    createReporterAdapter<null>({
      name: "full",
      capabilities,
      available: () => ({ available: true }),
      open: () => ({
        native: null,
        submit: () => ({
          status: "submitted",
          evidence: "sdk-call-returned",
          event: { id: "evt_1" },
          losses: [],
        }),
        flush: () => ({ status: "flushed" }),
        ambient: { session: () => {}, breadcrumb: () => {} },
        dispose: () => {},
      }),
    }),
});

testReporterAdapter({
  name: "minimal",
  createAdapter: () =>
    createReporterAdapter<null>({
      name: "minimal",
      capabilities: { ...capabilities, flush: "none", messages: false },
      available: () => ({ available: true }),
      open: () => ({
        native: null,
        submit: (report) => {
          if (report.kind === "message") {
            return { status: "skipped", reason: "unsupported-report-kind" };
          }

          return Promise.resolve({
            status: "submitted",
            evidence: "sdk-call-returned",
            event: null,
            losses: [],
          });
        },
        dispose: () => Promise.resolve(),
      }),
    }),
});

testReporterAdapter({
  name: "unavailable",
  createAdapter: () =>
    createReporterAdapter<null>({
      name: "unavailable",
      capabilities,
      available: () => ({ available: false, reason: "not on this platform" }),
      open: () => {
        throw new Error("An unavailable adapter must never be opened.");
      },
    }),
});
