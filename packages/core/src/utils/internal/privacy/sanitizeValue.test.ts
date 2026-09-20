import { expect, test, vi } from "vitest";

import type { PrivacyPolicy } from "src/types/internal/PrivacyPolicy";
import { DEFAULT_LIMITS } from "src/utils/constants/limits";
import { DEFAULT_REDACT } from "src/utils/constants/privacy";
import { sanitizeValue } from "src/utils/internal/privacy/sanitizeValue";

const policy = (overrides: Partial<PrivacyPolicy> = {}): PrivacyPolicy => ({
  redact: [],
  scrub: null,
  limits: DEFAULT_LIMITS,
  ...overrides,
});

const limited = (limits: Partial<PrivacyPolicy["limits"]>) =>
  policy({ limits: { ...DEFAULT_LIMITS, ...limits } });

test("plain data comes back equal but never as the same objects", () => {
  const input = {
    kind: "avatar",
    attempt: 2,
    nested: { ok: true, tags: ["a"] },
  };

  const { value, losses } = sanitizeValue(input, "contexts.upload", policy());

  expect(value).toEqual(input);
  expect(value).not.toBe(input);
  expect(losses).toEqual([]);
});

test("the result is frozen at every level", () => {
  const { value } = sanitizeValue({ nested: { list: [{}] } }, "c", policy());

  expect(Object.isFrozen(value)).toBe(true);
  expect(value).toSatisfy((result: { nested: { list: object[] } }) => {
    return (
      Object.isFrozen(result.nested) &&
      Object.isFrozen(result.nested.list) &&
      Object.isFrozen(result.nested.list[0])
    );
  });
});

test("a key rule redacts at any depth and ignores case", () => {
  const { value } = sanitizeValue(
    { auth: { SessionId: "abc" }, sessionid: "def", other: "kept" },
    "contexts.request",
    policy({ redact: ["sessionId"] }),
  );

  expect(value).toEqual({
    auth: { SessionId: "[Redacted]" },
    sessionid: "[Redacted]",
    other: "kept",
  });
});

test("a string rule is an exact key, never a substring", () => {
  const { value } = sanitizeValue(
    { count: 3, countdown: 9 },
    "contexts.timer",
    policy({ redact: ["count"] }),
  );

  expect(value).toEqual({ count: "[Redacted]", countdown: 9 });
});

test("a path rule redacts only the path it names", () => {
  const rules = policy({ redact: ["contexts.billing.note"] });

  expect(sanitizeValue({ note: "x" }, "contexts.billing", rules).value).toEqual(
    {
      note: "[Redacted]",
    },
  );
  expect(sanitizeValue({ note: "x" }, "contexts.upload", rules).value).toEqual({
    note: "x",
  });
});

test("a global RegExp rule matches every key, not every other one", () => {
  const { value } = sanitizeValue(
    { "x-internal-a": 1, "x-internal-b": 2, "x-internal-c": 3 },
    "contexts.headers",
    policy({ redact: [/^x-internal-/g] }),
  );

  expect(value).toEqual({
    "x-internal-a": "[Redacted]",
    "x-internal-b": "[Redacted]",
    "x-internal-c": "[Redacted]",
  });
});

test("the default rules cover the usual credentials", () => {
  const { value } = sanitizeValue(
    {
      accessToken: "a",
      Authorization: "b",
      password: "c",
      clientSecret: "d",
      cookie: "e",
      api_key: "f",
      apiKey: "g",
      plan: "pro",
    },
    "contexts.request",
    policy({ redact: DEFAULT_REDACT }),
  );

  expect(value).toEqual({
    accessToken: "[Redacted]",
    Authorization: "[Redacted]",
    password: "[Redacted]",
    clientSecret: "[Redacted]",
    cookie: "[Redacted]",
    api_key: "[Redacted]",
    apiKey: "[Redacted]",
    plan: "pro",
  });
});

test("getters and toJSON are never run", () => {
  const getter = vi.fn(() => "computed");
  const toJSON = vi.fn(() => "serialized");
  const input = { toJSON };
  Object.defineProperty(input, "computed", { get: getter, enumerable: true });

  const { value } = sanitizeValue(input, "contexts.live", policy());

  expect(value).toEqual({ toJSON: "[Function]", computed: "[Accessor]" });
  expect(getter).not.toHaveBeenCalled();
  expect(toJSON).not.toHaveBeenCalled();
});

test("array accessors and custom slice methods are never run", () => {
  const getter = vi.fn(() => "computed");
  const slice = vi.fn(() => ["substituted"]);
  const input = ["first"];
  Object.defineProperty(input, "1", { get: getter, enumerable: true });
  Object.defineProperty(input, "slice", { value: slice });

  expect(sanitizeValue(input, "c", policy()).value).toEqual([
    "first",
    "[Accessor]",
  ]);
  expect(getter).not.toHaveBeenCalled();
  expect(slice).not.toHaveBeenCalled();
});

test("array holes do not inherit values from the prototype", () => {
  const input = new Array(1);
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, "0", { value: "inherited" });
  Object.setPrototypeOf(input, prototype);

  expect(sanitizeValue(input, "c", policy()).value).toEqual([null]);
});

test("date formatting never calls an application's override", () => {
  const input = new Date("2026-09-20T10:00:00.000Z");
  const format = vi.fn(() => "unfiltered application data");
  input.toISOString = format;

  expect(sanitizeValue(input, "c", policy()).value).toBe(
    "2026-09-20T10:00:00.000Z",
  );
  expect(format).not.toHaveBeenCalled();
});

test("prototype-named keys remain own data properties", () => {
  const input = JSON.parse(
    '{"__proto__":{"owner":"kept"},"constructor":"also kept"}',
  );

  expect(JSON.stringify(sanitizeValue(input, "c", policy()).value)).toBe(
    JSON.stringify(input),
  );
});

test("a circular reference is marked where it would repeat", () => {
  const input: Record<string, unknown> = { name: "root" };
  input.self = input;

  expect(sanitizeValue(input, "c", policy()).value).toEqual({
    name: "root",
    self: "[Circular]",
  });
});

test("the same object used twice side by side is not mistaken for a cycle", () => {
  const shared = { id: 1 };

  expect(
    sanitizeValue({ first: shared, second: shared }, "c", policy()).value,
  ).toEqual({ first: { id: 1 }, second: { id: 1 } });
});

test("data deeper than the limit is cut and the cut is recorded", () => {
  const { value, losses } = sanitizeValue(
    { a: { b: { c: "too deep" } } },
    "contexts.deep",
    limited({ depth: 2 }),
  );

  expect(value).toEqual({ a: { b: "[Depth limit]" } });
  expect(losses).toEqual([{ path: "contexts.deep.a.b", reason: "truncated" }]);
});

test("an object wider than the limit keeps its first keys", () => {
  const { value, losses } = sanitizeValue(
    { a: 1, b: 2, c: 3 },
    "contexts.wide",
    limited({ breadth: 2 }),
  );

  expect(value).toEqual({ a: 1, b: 2 });
  expect(losses).toEqual([{ path: "contexts.wide", reason: "truncated" }]);
});

test("object truncation stops inspecting properties after detecting an omitted key", () => {
  const input = new Proxy(
    { first: 1, second: 2, third: 3, ignored: 4 },
    {
      getOwnPropertyDescriptor: (target, key) => {
        if (key === "ignored") {
          throw new Error("An omitted property must not be inspected.");
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    },
  );

  expect(sanitizeValue(input, "c", limited({ breadth: 2 }))).toEqual({
    value: { first: 1, second: 2 },
    losses: [{ path: "c", reason: "truncated" }],
  });
});

test("object sanitization does not inspect symbol properties it cannot retain", () => {
  const hidden = Symbol("hidden");
  const input = new Proxy(
    { visible: 1, [hidden]: 2 },
    {
      getOwnPropertyDescriptor: (target, key) => {
        if (key === hidden) {
          throw new Error("A symbol property must not be inspected.");
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    },
  );

  expect(sanitizeValue(input, "c", policy())).toEqual({
    value: { visible: 1 },
    losses: [],
  });
});

test("non-enumerable properties do not consume object breadth or cause truncation", () => {
  const input = Object.defineProperties(
    {},
    {
      firstHidden: { value: "private" },
      visible: { value: "kept", enumerable: true },
      lastHidden: { value: "private" },
    },
  );

  expect(sanitizeValue(input, "c", limited({ breadth: 1 }))).toEqual({
    value: { visible: "kept" },
    losses: [],
  });
});

test.each([
  { breadth: 1.5, value: { first: 1 } },
  { breadth: Number.NaN, value: {} },
])(
  "object breadth $breadth keeps the same prefix as array length coercion",
  ({ breadth, value }) => {
    expect(
      sanitizeValue({ first: 1, second: 2 }, "c", limited({ breadth })),
    ).toEqual({ value, losses: [{ path: "c", reason: "truncated" }] });
  },
);

test("retained object values are snapshotted before a scrubber changes the input", () => {
  const input = { first: "one", second: "original" };

  expect(
    sanitizeValue(
      input,
      "c",
      policy({
        scrub: (text) => {
          input.second = "changed";
          return text;
        },
      }),
    ),
  ).toEqual({ value: { first: "one", second: "original" }, losses: [] });
});

test("an array longer than the limit keeps its first items", () => {
  const { value, losses } = sanitizeValue(
    { list: [1, 2, 3, 4] },
    "c",
    limited({ breadth: 3 }),
  );

  expect(value).toEqual({ list: [1, 2, 3] });
  expect(losses).toEqual([{ path: "c.list", reason: "truncated" }]);
});

test("array truncation never inspects elements beyond the retained prefix", () => {
  const input = new Proxy([1, 2, 3, 4], {
    getOwnPropertyDescriptor: (target, key) => {
      if (key === "2" || key === "3") {
        throw new Error("An omitted element must not be inspected.");
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });

  expect(sanitizeValue(input, "c", limited({ breadth: 2 }))).toEqual({
    value: [1, 2],
    losses: [{ path: "c", reason: "truncated" }],
  });
});

test("array sanitization ignores unrelated properties that cannot be inspected", () => {
  const input = new Proxy(Object.assign([1, 2], { unrelated: "ignored" }), {
    getOwnPropertyDescriptor: (target, key) => {
      if (key === "unrelated") {
        throw new Error("An unrelated property must not be inspected.");
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });

  expect(sanitizeValue(input, "c", policy())).toEqual({
    value: [1, 2],
    losses: [],
  });
});

test.each(["length", "0"])(
  "an unreadable array %s is contained before sanitization",
  (unreadable) => {
    const input = new Proxy([1, 2], {
      getOwnPropertyDescriptor: (target, key) => {
        if (key === unreadable) {
          throw new Error("The array cannot be inspected.");
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });

    expect(sanitizeValue(input, "c", policy())).toEqual({
      value: "[Unreadable]",
      losses: [],
    });
  },
);

test("a long string is cut to the limit", () => {
  const { value, losses } = sanitizeValue(
    { note: "n".repeat(20) },
    "c",
    limited({ stringLength: 5 }),
  );

  expect(value).toEqual({ note: "nnnnn" });
  expect(losses).toEqual([{ path: "c.note", reason: "truncated" }]);
});

test("data larger than the size budget stops where the budget ends", () => {
  const { value, losses } = sanitizeValue(
    { first: "a".repeat(30), second: "b".repeat(30), third: "c".repeat(30) },
    "c",
    limited({ totalSize: 50 }),
  );

  expect(value).toEqual({ first: "a".repeat(30), second: "[Size limit]" });
  expect(losses).toEqual([
    { path: "c.second", reason: "truncated" },
    { path: "c", reason: "truncated" },
  ]);
});

test("values JSON cannot carry become readable strings", () => {
  const { value } = sanitizeValue(
    {
      when: new Date("2026-09-20T10:00:00.000Z"),
      never: new Date("not a date"),
      big: 10n,
      symbol: Symbol("s"),
      nan: Number.NaN,
      callback: () => {},
      missing: undefined,
      nothing: null,
    },
    "c",
    policy(),
  );

  expect(value).toEqual({
    when: "2026-09-20T10:00:00.000Z",
    never: "[Invalid Date]",
    big: "10",
    symbol: "Symbol(s)",
    nan: "NaN",
    callback: "[Function]",
    nothing: null,
  });
});

test("an object that cannot be read is replaced, not thrown", () => {
  const hostile = new Proxy(
    {},
    {
      ownKeys: () => {
        throw new Error("ownKeys trap");
      },
    },
  );

  expect(sanitizeValue({ hostile }, "c", policy()).value).toEqual({
    hostile: "[Unreadable]",
  });
});

test("the scrubber sees every string with its path", () => {
  const scrub = vi.fn((text: string) =>
    text.replace("ada@example.com", "[email]"),
  );

  const { value } = sanitizeValue(
    { note: "from ada@example.com", list: ["ada@example.com"] },
    "contexts.mail",
    policy({ scrub }),
  );

  expect(value).toEqual({ note: "from [email]", list: ["[email]"] });
  expect(scrub.mock.calls).toEqual([
    ["from ada@example.com", "contexts.mail.note"],
    ["ada@example.com", "contexts.mail.list.0"],
  ]);
});

test("a secret that straddles the cut is scrubbed whole before the string is cut", () => {
  const scrub = (text: string) => text.replace("sk_live_12345", "[key]");

  const { value } = sanitizeValue(
    { note: "key sk_live_12345 trailing" },
    "c",
    policy({ scrub, limits: { ...DEFAULT_LIMITS, stringLength: 10 } }),
  );

  expect(value).toEqual({ note: "key [key] " });
});

test("a redacted value is never shown to the scrubber", () => {
  const scrub = vi.fn((text: string) => text);

  sanitizeValue(
    { password: "hunter2" },
    "c",
    policy({ redact: ["password"], scrub }),
  );

  expect(scrub).not.toHaveBeenCalled();
});

test("a scrubber that throws is not contained here, so the caller can fail closed", () => {
  const failure = new Error("scrubber exploded");

  expect(() =>
    sanitizeValue(
      { note: "text" },
      "c",
      policy({
        scrub: () => {
          throw failure;
        },
      }),
    ),
  ).toThrow(failure);
});

test("a scrubber that returns something other than a string is a failure", () => {
  const scrub: PrivacyPolicy["scrub"] = () => JSON.parse("42");

  expect(() => sanitizeValue({ note: "text" }, "c", policy({ scrub }))).toThrow(
    "The scrub option must return a string.",
  );
});
