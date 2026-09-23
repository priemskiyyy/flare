import { expect, test } from "vitest";

import type { ReportLayer } from "src/types/internal/ReportLayer";
import type { MappingLoss } from "src/types/MappingLoss";
import type { NormalizedException } from "src/types/NormalizedException";
import type { SessionSnapshot } from "src/types/SessionSnapshot";
import { composeReport } from "src/utils/internal/report/composeReport";

const EMPTY_LAYER: ReportLayer = {};

const session = (
  overrides: Partial<SessionSnapshot> = {},
): SessionSnapshot => ({
  generation: 3,
  user: { id: "ada" },
  tags: {},
  contexts: {},
  breadcrumbs: [],
  ...overrides,
});

const compose = (
  overrides: Partial<Parameters<typeof composeReport>[0]> = {},
) =>
  composeReport({
    id: "report-1",
    timestamp: 1_000,
    payload: { kind: "message", message: "Unexpected payment state" },
    defaults: EMPTY_LAYER,
    session: session(),
    scope: EMPTY_LAYER,
    options: EMPTY_LAYER,
    losses: [],
    ...overrides,
  });

test("a report carries the identity it was captured under", () => {
  expect(compose().identity).toEqual({ generation: 3, user: { id: "ada" } });
});

test("tags merge shallowly in the order defaults, session, scope, options", () => {
  const report = compose({
    defaults: {
      tags: { app: "web", area: "default", plan: "free" },
    },
    session: session({ tags: { area: "session", plan: "pro" } }),
    scope: { tags: { area: "scope" } },
    options: { tags: { attempt: 2 } },
  });

  expect(report.tags).toEqual({
    app: "web",
    plan: "pro",
    area: "scope",
    attempt: 2,
  });
});

test("a context replaces the same name from a lower layer and is never merged into it", () => {
  const report = compose({
    defaults: { contexts: { device: { model: "x" } } },
    session: session({ contexts: { upload: { kind: "avatar", attempt: 1 } } }),
    options: { contexts: { upload: { attempt: 2 } } },
  });

  expect(report.contexts).toEqual({
    device: { model: "x" },
    upload: { attempt: 2 },
  });
});

test("the user of the highest layer that names one wins", () => {
  expect(
    compose({ scope: { user: { id: "scope-user" } } }).identity.user,
  ).toEqual({ id: "scope-user" });
  expect(
    compose({
      scope: { user: { id: "scope-user" } },
      options: { user: { id: "option-user" } },
    }).identity.user,
  ).toEqual({ id: "option-user" });
});

test("a layer can clear the user for one report without touching the session", () => {
  expect(compose({ options: { user: null } }).identity).toEqual({
    generation: 3,
    user: null,
  });
});

test("operation comes from the highest layer that names one", () => {
  expect(compose().operation).toBeNull();
  expect(
    compose({
      scope: { operation: "upload-avatar" },
    }).operation,
  ).toBe("upload-avatar");
  expect(
    compose({
      scope: { operation: "upload-avatar" },
      options: { operation: null },
    }).operation,
  ).toBeNull();
});

test("an exception defaults to error and a message to info", () => {
  const exception: NormalizedException = {
    origin: "error",
    name: "Error",
    message: "boom",
    stack: null,
    causes: [],
    aggregated: [],
  };

  expect(compose({ payload: { kind: "exception", exception } }).level).toBe(
    "error",
  );
  expect(compose().level).toBe("info");
});

test("an explicit level from the highest layer wins", () => {
  expect(
    compose({
      scope: { level: "warning" },
      options: { level: "fatal" },
    }).level,
  ).toBe("fatal");
});

test("breadcrumbs are the session's snapshot at capture time", () => {
  const breadcrumbs = [{ name: "opened", data: null, timestamp: 1 }];

  expect(compose({ session: session({ breadcrumbs }) }).breadcrumbs).toEqual(
    breadcrumbs,
  );
});

test("losses gathered on the way in travel with the report", () => {
  const losses: MappingLoss[] = [{ path: "tags.plan", reason: "invalid" }];

  expect(compose({ losses }).losses).toEqual(losses);
});

test("the composed report is frozen", () => {
  const report = compose();

  expect(Object.isFrozen(report)).toBe(true);
  expect(Object.isFrozen(report.identity)).toBe(true);
  expect(Object.isFrozen(report.tags)).toBe(true);
  expect(Object.isFrozen(report.contexts)).toBe(true);
  expect(Object.isFrozen(report.losses)).toBe(true);
});
