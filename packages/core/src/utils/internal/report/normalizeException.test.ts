import { runInNewContext } from "node:vm";
import { expect, test, vi } from "vitest";

import type { FlareLimits } from "src/types/FlareLimits";
import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import { DEFAULT_LIMITS } from "src/utils/constants/limits";
import { normalizeException } from "src/utils/internal/report/normalizeException";

const normalize = (
  thrown: unknown,
  limits: Partial<FlareLimits> = {},
  scrub: PrivacyPolicy["scrub"] = null,
) =>
  normalizeException(thrown, {
    redact: () => false,
    scrub,
    limits: { ...DEFAULT_LIMITS, ...limits },
  });

class UploadError extends Error {
  override name = "UploadError";
}

test("an Error subclass keeps its name, message and stack", () => {
  const error = new UploadError("upload failed");

  const { exception, losses } = normalize(error);

  expect(exception).toMatchObject({
    origin: "error",
    name: "UploadError",
    message: "upload failed",
    stack: error.stack,
    causes: [],
    aggregated: [],
  });
  expect(losses).toEqual([]);
});

test("an Error from another realm is recognized by shape, not by instanceof", () => {
  const foreign: unknown = runInNewContext(
    "new TypeError('from another realm')",
  );

  expect(foreign instanceof Error).toBe(false);
  expect(normalize(foreign).exception).toMatchObject({
    origin: "error-like",
    name: "TypeError",
    message: "from another realm",
  });
});

test("an error-like object's name and message are read once", () => {
  const name = vi.fn(() => "RemoteError");
  const message = vi.fn(() => "Request failed");

  const error = Object.defineProperties(
    {},
    {
      name: { get: name },
      message: { get: message },
    },
  );

  expect(normalize(error).exception).toMatchObject({
    origin: "error-like",
    name: "RemoteError",
    message: "Request failed",
  });
  expect(name).toHaveBeenCalledTimes(1);
  expect(message).toHaveBeenCalledTimes(1);
});

test("a DOMException is reported under its own name", () => {
  const { exception } = normalize(new DOMException("aborted", "AbortError"));

  expect(exception).toMatchObject({
    origin: "dom-exception",
    name: "AbortError",
    message: "aborted",
  });
});

test.each([
  { thrown: "plain string", message: "plain string" },
  { thrown: 42, message: "42" },
  { thrown: false, message: "false" },
  { thrown: 10n, message: "10" },
  { thrown: Symbol("token"), message: "Symbol(token)" },
])("a thrown primitive becomes a NonError with message $message", (row) => {
  expect(normalize(row.thrown).exception).toEqual({
    origin: "primitive",
    name: "NonError",
    message: row.message,
    stack: null,
    causes: [],
    aggregated: [],
  });
});

test.each([
  { thrown: null, message: "null" },
  { thrown: undefined, message: "undefined" },
])("a thrown $message is reported as nullish", (row) => {
  expect(normalize(row.thrown).exception).toMatchObject({
    origin: "nullish",
    name: "NonError",
    message: row.message,
  });
});

test("a thrown plain object is described by its keys and never by its values", () => {
  const { exception } = normalize({ code: 401, email: "ada@example.com" });

  expect(exception).toMatchObject({
    origin: "object",
    name: "NonError",
    message: "Object thrown with keys: code, email",
  });
  expect(exception.message).not.toContain("ada@example.com");
});

test("a circular object is described without recursing into it", () => {
  const circular: Record<string, unknown> = { code: 1 };

  circular.self = circular;

  expect(normalize(circular).exception.message).toBe(
    "Object thrown with keys: code, self",
  );
});

test("a thrown function is named, not called", () => {
  const handler = vi.fn();

  expect(normalize(handler).exception).toMatchObject({
    origin: "function",
    message: "Function thrown",
  });
  expect(handler).not.toHaveBeenCalled();
});

test("a getter that throws costs only the field it guards", () => {
  const error = new UploadError("unused");

  Object.defineProperty(error, "message", {
    get: () => {
      throw new Error("getter exploded");
    },
  });

  expect(normalize(error).exception).toMatchObject({
    origin: "error",
    name: "UploadError",
    message: "",
  });
});

test("a proxy whose every trap throws is still reported", () => {
  const hostile = new Proxy(
    {},
    {
      get: () => {
        throw new Error("get trap");
      },
      ownKeys: () => {
        throw new Error("ownKeys trap");
      },
      getPrototypeOf: () => {
        throw new Error("getPrototypeOf trap");
      },
    },
  );

  expect(normalize(hostile).exception).toMatchObject({
    origin: "object",
    name: "NonError",
    message: "Object thrown",
  });
});

test("custom toJSON and toString are never invoked", () => {
  const toJSON = vi.fn(() => "serialized");
  const toString = vi.fn(() => "stringified");
  const error = Object.assign(new Error("real message"), { toJSON, toString });
  const object = { toJSON, toString };

  normalize(error);
  normalize(object);

  expect(toJSON).not.toHaveBeenCalled();
  expect(toString).not.toHaveBeenCalled();
});

test("custom aggregate array methods cannot bypass normalization", () => {
  const raw = { secret: "must not enter the report" };
  const map = vi.fn(() => [raw]);
  const slice = vi.fn(() => ({ map }));
  const errors = Object.assign([new Error("member")], { slice });
  const error = Object.assign(new Error("outer"), { errors });

  expect(normalize(error).exception.aggregated).toMatchObject([
    { name: "Error", message: "member" },
  ]);
  expect(slice).not.toHaveBeenCalled();
  expect(map).not.toHaveBeenCalled();
  expect(Object.isFrozen(raw)).toBe(false);
});

test("a message that is not a string is dropped rather than coerced", () => {
  const error = new Error("unused");

  Object.defineProperty(error, "message", {
    value: { toString: () => "coerced" },
  });

  expect(normalize(error).exception.message).toBe("");
});

test("an engine that fails while formatting the stack costs only the stack", () => {
  // V8 formats `stack` lazily on first read and coerces `message` itself while
  // doing so. Flare cannot prevent that read, only contain it.
  const error = new Error("unused");

  Object.defineProperty(error, "message", {
    value: {
      toString: () => {
        throw new Error("toString exploded");
      },
    },
  });

  expect(normalize(error).exception).toMatchObject({
    origin: "error",
    message: "",
    stack: null,
  });
});

test("arbitrary properties of an Error are never read", () => {
  const secret = vi.fn(() => "token");
  const error = new Error("with extras");

  Object.defineProperty(error, "secret", { get: secret, enumerable: true });

  normalize(error);

  expect(secret).not.toHaveBeenCalled();
});

test("the cause chain is kept from nearest to furthest", () => {
  const root = new Error("disk full");
  const middle = new Error("write failed", { cause: root });
  const top = new Error("upload failed", { cause: middle });

  expect(normalize(top).exception.causes).toEqual([
    { name: "Error", message: "write failed", stack: middle.stack },
    { name: "Error", message: "disk full", stack: root.stack },
  ]);
});

test("a cause that is not an Error is kept as a NonError", () => {
  const error = new Error("rejected", { cause: "timeout" });

  expect(normalize(error).exception.causes).toEqual([
    { name: "NonError", message: "timeout", stack: null },
  ]);
});

test("a circular cause chain ends where it would repeat", () => {
  const first = new Error("first");
  const second = new Error("second", { cause: first });

  first.cause = second;

  expect(
    normalize(first).exception.causes.map((cause) => cause.message),
  ).toEqual(["second"]);
});

test("a cause chain deeper than the limit is cut and the cut is recorded", () => {
  const deepest = new Error("level 3");

  const chain = new Error("level 0", {
    cause: new Error("level 1", {
      cause: new Error("level 2", { cause: deepest }),
    }),
  });

  const { exception, losses } = normalize(chain, { causeDepth: 2 });

  expect(exception.causes.map((cause) => cause.message)).toEqual([
    "level 1",
    "level 2",
  ]);
  expect(losses).toEqual([{ path: "exception.causes", reason: "truncated" }]);
});

test("an AggregateError keeps its first errors up to the limit", () => {
  const aggregate = new AggregateError(
    [new Error("one"), "two", new Error("three")],
    "several failed",
  );

  const { exception, losses } = normalize(aggregate, { aggregatedErrors: 2 });

  expect(exception).toMatchObject({
    name: "AggregateError",
    message: "several failed",
  });
  expect(exception.aggregated.map((error) => error.message)).toEqual([
    "one",
    "two",
  ]);
  expect(losses).toEqual([
    { path: "exception.aggregated", reason: "truncated" },
  ]);
});

test("an oversized message and stack are cut to their limits and recorded", () => {
  const error = new Error("m".repeat(50));

  error.stack = "s".repeat(80);

  const { exception, losses } = normalize(error, {
    messageLength: 10,
    stackLength: 20,
  });

  expect(exception.message).toBe("m".repeat(10));
  expect(exception.stack).toBe("s".repeat(20));
  expect(losses).toEqual([
    { path: "exception.message", reason: "truncated" },
    { path: "exception.stack", reason: "truncated" },
  ]);
});

test("losses retain field order across the root error, causes and aggregate members", () => {
  const cause = new Error("cause", { cause: new Error("omitted") });

  delete cause.stack;

  const member = new Error("member");

  member.stack = "trace";

  const error = new AggregateError([member, new Error("omitted")], "outer", {
    cause,
  });

  error.name = "N".repeat(201);
  error.stack = "trace";

  const { exception, losses } = normalize(error, {
    messageLength: 3,
    stackLength: 3,
    causeDepth: 1,
    aggregatedErrors: 1,
  });

  expect(exception.causes[0]?.stack).toBeNull();
  expect(losses).toEqual([
    { path: "exception.name", reason: "truncated" },
    { path: "exception.message", reason: "truncated" },
    { path: "exception.stack", reason: "truncated" },
    { path: "exception.causes", reason: "truncated" },
    { path: "exception.causes.0.message", reason: "truncated" },
    { path: "exception.aggregated", reason: "truncated" },
    { path: "exception.aggregated.0.message", reason: "truncated" },
    { path: "exception.aggregated.0.stack", reason: "truncated" },
  ]);
});

test("an Error without a usable name falls back to Error", () => {
  const error = new Error("nameless");

  Object.defineProperty(error, "name", { value: "" });

  expect(normalize(error).exception.name).toBe("Error");
});

test("the scrubber rewrites exception text before it is cut", () => {
  const scrub = (text: string) => text.replace("sk_live_12345", "[key]");
  const error = new Error("key sk_live_12345 trailing");

  expect(normalize(error, { messageLength: 10 }, scrub).exception.message).toBe(
    "key [key] ",
  );
});

test("the scrubber sees the message and stack of the error and of each cause", () => {
  const seen: string[] = [];

  const scrub = (text: string, path: string) => {
    seen.push(path);

    return text;
  };

  normalize(new Error("top", { cause: new Error("root") }), {}, scrub);

  expect(seen).toEqual([
    "exception.message",
    "exception.stack",
    "exception.causes.0.message",
    "exception.causes.0.stack",
  ]);
});

test("a scrubber that throws is not contained here, so the caller can fail closed", () => {
  const failure = new Error("scrubber exploded");

  expect(() =>
    normalize(new Error("any"), {}, () => {
      throw failure;
    }),
  ).toThrow(failure);
});
