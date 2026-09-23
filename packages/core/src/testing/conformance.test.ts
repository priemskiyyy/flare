import { testReporterAdapter } from "src/testing/testReporterAdapter";

// The suite is run against the two shapes every adapter takes: one with every
// optional member, and one with none of them.
testReporterAdapter({
  name: "full",
  createAdapter: () => ({
    name: "full",
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
    }),
  }),
});

testReporterAdapter({
  name: "minimal",
  createAdapter: () => ({
    name: "minimal",
    open: () => ({
      native: null,
      submit: (report) => {
        if (report.kind === "message") {
          return { status: "skipped", reason: "unsupported-report-kind" };
        }

        return Promise.resolve({
          status: "submitted",
          evidence: "sdk-call-returned",
        });
      },
      dispose: () => Promise.resolve(),
    }),
  }),
});
