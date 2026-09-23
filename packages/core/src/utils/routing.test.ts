import { expect, test } from "vitest";

import { createMockAdapter } from "src/mock/createMockAdapter";
import { Flare } from "src/utils/Flare";

const trio = () => {
  const sentry = createMockAdapter({ name: "sentry" });
  const backend = createMockAdapter({ name: "backend" });
  const console = createMockAdapter({ name: "console" });

  return {
    sentry,
    backend,
    console,
    destinations: {
      sentry: sentry.adapter,
      backend: backend.adapter,
      console: console.adapter,
    },
  };
};

const counts = (mocks: ReturnType<typeof trio>) => ({
  sentry: mocks.sentry.submissions.length,
  backend: mocks.backend.submissions.length,
  console: mocks.console.submissions.length,
});

test("without defaults.to a report goes to every destination", () => {
  const mocks = trio();
  const flare = new Flare({ destinations: mocks.destinations });

  flare.start();

  flare.capture(new Error("boom"));

  expect(counts(mocks)).toEqual({ sentry: 1, backend: 1, console: 1 });
});

test("a defaults.to list selects the destinations most captures go to", () => {
  const mocks = trio();

  const flare = new Flare({
    destinations: mocks.destinations,
    defaults: { to: ["sentry", "backend"] },
  });

  flare.start();

  flare.capture(new Error("boom"));

  expect(counts(mocks)).toEqual({ sentry: 1, backend: 1, console: 0 });
});

test("a report's own to replaces defaults.to and never merges with it", () => {
  const mocks = trio();

  const flare = new Flare({
    destinations: mocks.destinations,
    defaults: { to: ["sentry", "backend"] },
  });

  flare.start();

  const receipt = flare.capture(new Error("boom"), { to: ["console"] });

  expect(counts(mocks)).toEqual({ sentry: 0, backend: 0, console: 1 });
  expect(Object.keys(receipt.status.get())).toContain("outcomes");
  expect(receipt.status.get()).toMatchObject({
    outcomes: { console: { status: "submitted" } },
  });
});

test("a defaults.to function decides per report from the sanitized report", () => {
  const mocks = trio();

  const flare = new Flare({
    destinations: mocks.destinations,
    defaults: {
      to: ({ report }) => {
        if (report.level === "fatal") {
          return ["sentry", "backend"];
        }

        return ["console"];
      },
    },
  });

  flare.start();

  flare.capture(new Error("minor"));
  flare.capture(new Error("major"), { level: "fatal" });

  expect(counts(mocks)).toEqual({ sentry: 1, backend: 1, console: 1 });
});

test("a destination named twice receives the report once", () => {
  const mocks = trio();
  const flare = new Flare({ destinations: mocks.destinations });

  flare.start();

  flare.capture(new Error("boom"), { to: ["sentry", "sentry"] });

  expect(counts(mocks)).toEqual({ sentry: 1, backend: 0, console: 0 });
});

test("an empty defaults.to drops the report as no-destinations", async () => {
  const mocks = trio();

  const flare = new Flare({
    destinations: mocks.destinations,
    defaults: { to: () => [] },
  });

  flare.start();

  await expect(flare.capture(new Error("boom")).settled).resolves.toEqual({
    state: "dropped",
    reason: "no-destinations",
  });
});

test("a defaults.to that throws fails closed: the report goes nowhere", async () => {
  const mocks = trio();

  const flare = new Flare({
    destinations: mocks.destinations,
    defaults: {
      to: () => {
        throw new Error("routing bug");
      },
    },
  });

  flare.start();

  await expect(flare.capture(new Error("boom")).settled).resolves.toEqual({
    state: "dropped",
    reason: "route-failed",
  });
  expect(counts(mocks)).toEqual({ sentry: 0, backend: 0, console: 0 });
});

test("a defaults.to function or a to that names an unknown destination fails closed too", async () => {
  const mocks = trio();

  const flare = new Flare({
    destinations: mocks.destinations,
    defaults: { to: () => JSON.parse('["sentry","typo"]') },
  });

  flare.start();

  await expect(flare.capture(new Error("boom")).settled).resolves.toEqual({
    state: "dropped",
    reason: "route-failed",
  });
  await expect(
    flare.capture(new Error("boom"), { to: JSON.parse('["sentry","typo"]') })
      .settled,
  ).resolves.toEqual({ state: "dropped", reason: "route-failed" });
  expect(counts(mocks)).toEqual({ sentry: 0, backend: 0, console: 0 });
});

test("one destination failing never blocks or repeats another", async () => {
  const failure = new Error("backend down");
  const sentry = createMockAdapter();

  const backend = createMockAdapter({
    onSubmit: () => {
      throw failure;
    },
  });

  const flare = new Flare({
    destinations: { sentry: sentry.adapter, backend: backend.adapter },
  });

  flare.start();

  const status = await flare.capture(new Error("boom")).settled;

  expect(status).toMatchObject({
    state: "settled",
    outcomes: {
      sentry: { status: "submitted" },
      backend: { status: "failed", error: failure },
    },
  });
  expect(sentry.submissions).toHaveLength(1);
});

test("a hanging destination delays only its own outcome", async () => {
  const fast = createMockAdapter();
  const slow = createMockAdapter({ hold: true });

  const flare = new Flare({
    destinations: { fast: fast.adapter, slow: slow.adapter },
  });

  flare.start();

  const receipt = flare.capture(new Error("boom"));

  expect(receipt.status.get()).toMatchObject({
    state: "pending",
    outcomes: { fast: { status: "submitted" }, slow: null },
  });

  slow.submissions[0]?.settle();

  await expect(receipt.settled).resolves.toMatchObject({ state: "settled" });
});
