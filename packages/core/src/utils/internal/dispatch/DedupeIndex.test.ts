import { expect, test } from "vitest";

import { DedupeIndex } from "src/utils/internal/dispatch/DedupeIndex";

const index = (overrides: { window?: number; maxKeys?: number } = {}) =>
  new DedupeIndex({ window: 1_000, maxKeys: 100, ...overrides });

const seen = (
  dedupe: DedupeIndex,
  entry: Partial<Parameters<DedupeIndex["isDuplicate"]>[0]>,
) =>
  dedupe.isDuplicate({
    generation: 1,
    key: null,
    thrown: undefined,
    now: 0,
    ...entry,
  });

test("an explicit key is a duplicate the second time", () => {
  const dedupe = index();

  expect(seen(dedupe, { key: "checkout-failed" })).toBe(false);
  expect(seen(dedupe, { key: "checkout-failed" })).toBe(true);
});

test("an explicit key does not outlive the identity it was seen under", () => {
  const dedupe = index();

  seen(dedupe, { key: "checkout-failed", generation: 1 });

  expect(seen(dedupe, { key: "checkout-failed", generation: 2 })).toBe(false);
});

test("the oldest explicit keys are forgotten once the index is full", () => {
  const dedupe = index({ maxKeys: 2 });

  seen(dedupe, { key: "a" });
  seen(dedupe, { key: "b" });
  seen(dedupe, { key: "c" });

  expect(seen(dedupe, { key: "a" })).toBe(false);
  expect(seen(dedupe, { key: "c" })).toBe(true);
});

test("the same Error object is a duplicate only within the window", () => {
  const dedupe = index({ window: 1_000 });
  const error = new Error("boom");

  expect(seen(dedupe, { thrown: error, now: 0 })).toBe(false);
  expect(seen(dedupe, { thrown: error, now: 999 })).toBe(true);
  expect(seen(dedupe, { thrown: error, now: 2_500 })).toBe(false);
});

test("equal but distinct errors, and equal primitives, are separate occurrences", () => {
  const dedupe = index();

  expect(seen(dedupe, { thrown: new Error("boom") })).toBe(false);
  expect(seen(dedupe, { thrown: new Error("boom") })).toBe(false);
  expect(seen(dedupe, { thrown: "boom" })).toBe(false);
  expect(seen(dedupe, { thrown: "boom" })).toBe(false);
});

test("a zero window turns object identity dedupe off", () => {
  const dedupe = index({ window: 0 });
  const error = new Error("boom");

  seen(dedupe, { thrown: error });

  expect(seen(dedupe, { thrown: error })).toBe(false);
});

test("the same Error is a new occurrence after an account switch", () => {
  const dedupe = index();
  const error = new Error("shared failure");

  seen(dedupe, { thrown: error, generation: 1 });

  expect(seen(dedupe, { thrown: error, generation: 2 })).toBe(false);
});
