import type { FlareDiagnosticEvent } from "@priemskiyyy/flare";
import { expect, test } from "vitest";

import { describeContext } from "src/utils/describeContext";

const destinationOf = (source: FlareDiagnosticEvent["source"]) => {
  if (source !== "destination") {
    return null;
  }

  return "primary";
};

const event = (
  type: string,
  context: unknown,
  source: FlareDiagnosticEvent["source"] = "destination",
): FlareDiagnosticEvent => ({
  source,
  type,
  destination: destinationOf(source),
  report: null,
  timestamp: 0,
  context,
});

const summary = (
  type: string,
  context: unknown,
  source?: FlareDiagnosticEvent["source"],
) => describeContext(event(type, context, source)).summary;

test("summarises the fields Flare contexts carry", () => {
  expect(
    summary(
      "report accepted",
      { kind: "exception", destinations: ["primary", "backend"], losses: 2 },
      "report",
    ),
  ).toBe("exception · primary, backend · 2 losses");
  expect(
    summary(
      "report accepted",
      { kind: "message", destinations: ["primary"], losses: 1 },
      "report",
    ),
  ).toBe("message · primary · 1 loss");
  expect(
    summary("destination outcome", {
      status: "submitted",
      reason: null,
      losses: 0,
    }),
  ).toBe("submitted");
  expect(
    summary("destination outcome", {
      status: "skipped",
      reason: "start-failed",
      losses: 0,
    }),
  ).toBe("skipped · start-failed");
  expect(summary("report dropped", { reason: "stale-scope" }, "report")).toBe(
    "stale-scope",
  );
  expect(summary("identity changed", { generation: 3 }, "session")).toBe("#3");
  expect(summary("report buffered", { buffered: 2 })).toBe("2 buffered");
  expect(summary("flushed", { timeout: 1500 }, "runtime")).toBe("1500 ms");
  expect(summary("breadcrumb stale", { name: "opened" }, "session")).toBe(
    "opened",
  );
  expect(
    summary("session change rejected", { path: "tags.area" }, "session"),
  ).toBe("tags.area");
  expect(
    summary(
      "session losses",
      { losses: [{ path: "tags.area", reason: "invalid" }] },
      "session",
    ),
  ).toBe("1 loss");
  expect(summary("started", null, "runtime")).toBe("");
});

test("a key that looks like a secret is redacted, whatever put it there", () => {
  const described = describeContext(
    event("destination outcome", {
      status: "failed",
      authorization: "Bearer abc",
      nested: { apiToken: "abc" },
    }),
  );

  expect(described.context).toContain("[Redacted]");
  expect(described.context).not.toContain("abc");
  expect(described.context).toContain("nested");
});

test("bounds depth, breadth and repeated references without running getters", () => {
  let ran = false;

  const deep = Array.from({ length: 10 }).reduce<unknown>(
    (next) => ({ next }),
    {},
  );

  const wide = Object.fromEntries(
    Array.from({ length: 60 }, (_, index) => [`key${index}`, index]),
  );

  const context = {
    deep,
    wide,
    twice: [wide, wide],
    get trap() {
      ran = true;

      return "boom";
    },
  };

  const { context: text } = describeContext(
    event("destination submit", context),
  );

  expect(ran).toBe(false);
  expect(text).toContain("[Accessor]");
  expect(text).toContain("[Truncated]");
  expect(text).toContain("[Circular or repeated reference]");
});

test("a deep chain is cut at a fixed depth, whatever the budget has left", () => {
  const deep = Array.from({ length: 10 }).reduce<unknown>(
    (next) => ({ next }),
    { bottom: "unreachable" },
  );

  const { context: text } = describeContext(event("destination submit", deep));

  expect(text).toContain("[Truncated]");
  expect(text).not.toContain("unreachable");
  expect(text.match(/"next"/g)).toHaveLength(7);
});

test("a context that cannot be inspected is said to be so, and the row is still recorded", () => {
  const hostile = new Proxy(
    {},
    {
      ownKeys: () => {
        throw new Error("no keys for you");
      },
    },
  );

  expect(describeContext(event("destination submit", hostile))).toEqual({
    context: "[Unable to inspect this value]",
    summary: "",
    kind: "DESTINATION",
  });
});

test("whatever did not verifiably arrive is an error", () => {
  const kind = (
    type: string,
    context: unknown,
    source?: FlareDiagnosticEvent["source"],
  ) => describeContext(event(type, context, source)).kind;

  expect(kind("destination outcome", { status: "submitted" })).toBe(
    "DESTINATION",
  );

  for (const status of ["failed", "indeterminate", "dropped", "skipped"]) {
    expect(kind("destination outcome", { status })).toBe("ERROR");
  }

  expect(kind("destination outcome", null)).toBe("ERROR");
  expect(kind("report dropped", { reason: "route-failed" }, "report")).toBe(
    "ERROR",
  );
  expect(kind("rate limit reached", null, "report")).toBe("ERROR");
  expect(kind("session change rejected", { path: "user" }, "session")).toBe(
    "ERROR",
  );
  expect(kind("destination failed", null)).toBe("ERROR");
  expect(kind("ambient session failed", null)).toBe("ERROR");
  expect(kind("destination dispose failed", null)).toBe("ERROR");
});

test("everything else is filed under where it came from", () => {
  const kind = (
    type: string,
    source: FlareDiagnosticEvent["source"],
    context: unknown = null,
  ) => describeContext(event(type, context, source)).kind;

  expect(kind("report accepted", "report")).toBe("REPORT");
  expect(kind("destination ready", "destination")).toBe("DESTINATION");
  expect(kind("report buffered", "destination")).toBe("DESTINATION");
  expect(kind("identity changed", "session")).toBe("SESSION");
  expect(kind("breadcrumb stale", "session")).toBe("SESSION");
  expect(kind("session losses", "session")).toBe("SESSION");
  expect(kind("started", "runtime")).toBe("RUNTIME");
  expect(kind("flushed", "runtime")).toBe("RUNTIME");
  expect(kind("disposed", "runtime")).toBe("RUNTIME");
});
