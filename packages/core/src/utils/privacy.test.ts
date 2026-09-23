import { expect, test, vi } from "vitest";
import { z } from "zod";

import { createMockAdapter } from "src/mock/createMockAdapter";
import type { FlareDiagnosticEvent } from "src/types/FlareDiagnosticEvent";
import type { FlarePrivacy } from "src/types/FlarePrivacy";
import type { FlareSchema } from "src/types/FlareSchema";
import type { StandardSchema } from "src/types/StandardSchema";
import { Flare } from "src/utils/Flare";

const SECRET = "sk_live_12345";

const area: StandardSchema<"upload" | "editor"> = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) => {
      if (value === "upload" || value === "editor") {
        return { value };
      }

      return { issues: [{ message: "unknown area" }] };
    },
  },
};

test("the predicate is read once, when the Flare is built", () => {
  const mock = createMockAdapter();
  const privacy: FlarePrivacy = { redact: (key) => key === "ssn" };
  const flare = new Flare({ destinations: { primary: mock.adapter }, privacy });

  flare.start();
  privacy.redact = () => false;

  flare.capture(new Error("boom"), {
    contexts: { person: { ssn: "078-05-1120" } },
  });

  expect(mock.submissions[0]?.report.contexts).toEqual({
    person: { ssn: "[Redacted]" },
  });
});

test("the predicate is asked about every key with its full path, and about each context and breadcrumb by name", () => {
  const asked: string[] = [];
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    privacy: {
      redact: (key, path) => {
        asked.push(`${key} ${path}`);

        return false;
      },
    },
  });

  flare.start();
  flare.breadcrumb("opened", { screen: "cart" });
  flare.capture(new Error("boom"), {
    tags: { plan: "pro" },
    contexts: { payment: { card: { last4: "4242" } } },
  });

  expect(asked).toEqual(
    expect.arrayContaining([
      "opened breadcrumbs.opened",
      "screen breadcrumbs.opened.screen",
      "plan tags.plan",
      "payment contexts.payment",
      "card contexts.payment.card",
      "last4 contexts.payment.card.last4",
    ]),
  );
});

test("a context or breadcrumb whose name is sensitive is redacted whole, by default too", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();
  flare.context("apiKey", { value: SECRET });
  flare.breadcrumb("token", { value: SECRET });
  flare.capture(new Error("boom"));

  const report = mock.submissions[0]?.report;

  expect(report?.contexts).toEqual({});
  expect(report?.breadcrumbs).toEqual([
    expect.objectContaining({ name: "token", data: null }),
  ]);
  expect(JSON.stringify(report)).not.toContain(SECRET);
});

test("a predicate that throws drops the report rather than send it unredacted", () => {
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    privacy: {
      redact: () => {
        throw new Error("predicate exploded");
      },
    },
  });

  flare.start();

  const receipt = flare.capture(new Error("boom"), { tags: { plan: "pro" } });

  expect(receipt.status.get()).toEqual({
    state: "dropped",
    reason: "sanitizer-failed",
  });
  expect(mock.submissions).toEqual([]);
});

test("message and operation text is scrubbed, never redacted", () => {
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    privacy: { redact: () => true },
  });

  flare.start();
  flare.message("checkout retried", {
    operation: "checkout",
    tags: { plan: "pro" },
  });

  expect(mock.submissions[0]?.report).toMatchObject({
    message: "checkout retried",
    operation: "checkout",
    tags: { plan: "[Redacted]" },
  });
});

test("redact must be a function, which the constructor checks", () => {
  expect(
    () =>
      new Flare({
        destinations: { primary: createMockAdapter().adapter },
        // @ts-expect-error -- rules are no longer a list.
        privacy: { redact: ["token"] },
      }),
  ).toThrow(
    expect.objectContaining({
      name: "FlareError",
      code: "INVALID_CONFIGURATION",
      message: "privacy.redact must be a function.",
    }),
  );
});

test("a breadcrumb name is scrubbed and bounded like any other text", () => {
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    privacy: {
      scrub: (text) => text.replaceAll("ada@example.com", "[email]"),
      limits: { stringLength: 20 },
    },
  });

  flare.start();
  flare.breadcrumb(`Opened ada@example.com ${"x".repeat(50)}`);
  flare.capture(new Error("boom"));

  expect(mock.submissions[0]?.report.breadcrumbs[0]?.name).toBe(
    "Opened [email] xxxxx",
  );
});

test("redaction runs before the startup buffer, the mock, diagnostics and fan-out ever see the data", () => {
  const first = createMockAdapter();
  const second = createMockAdapter();

  const flare = new Flare({
    destinations: { first: first.adapter, second: second.adapter },
    privacy: { scrub: (text) => text.replaceAll(SECRET, "[key]") },
  });

  const events: FlareDiagnosticEvent[] = [];

  flare.diagnostics.events.subscribe((event) => events.push(event));
  flare.user({ id: "ada" });
  flare.context("request", {
    authorization: `Bearer ${SECRET}`,
    note: `used ${SECRET}`,
  });
  flare.breadcrumb("called", { apiKey: SECRET, url: `/charge?key=${SECRET}` });

  flare.capture(new Error(`charge failed for ${SECRET}`), {
    tags: { token: SECRET },
  });
  flare.start();

  const delivered = [...first.submissions, ...second.submissions].map(
    (submission) => submission.report,
  );

  expect(delivered).toHaveLength(2);
  expect(JSON.stringify(delivered)).not.toContain(SECRET);
  expect(JSON.stringify(events)).not.toContain(SECRET);
  expect(JSON.stringify(flare.diagnostics.get())).not.toContain(SECRET);
  expect(delivered[0]).toMatchObject({
    tags: { token: "[Redacted]" },
    contexts: { request: { authorization: "[Redacted]", note: "used [key]" } },
    breadcrumbs: [{ data: { apiKey: "[Redacted]", url: "/charge?key=[key]" } }],
    exception: { message: "charge failed for [key]" },
  });
});

test("a scrubber that throws fails closed: the report is dropped, not sent unscrubbed", async () => {
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    privacy: {
      scrub: () => {
        throw new Error("scrubber exploded");
      },
    },
  });

  flare.start();

  await expect(flare.capture(new Error("boom")).settled).resolves.toEqual({
    state: "dropped",
    reason: "sanitizer-failed",
  });
  await expect(flare.message("note").settled).resolves.toEqual({
    state: "dropped",
    reason: "sanitizer-failed",
  });
  expect(mock.submissions).toEqual([]);
});

test("a scrubber that throws on session data costs that data and never the host", () => {
  let explode = true;
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    privacy: {
      scrub: (text) => {
        if (explode) {
          throw new Error("scrubber exploded");
        }

        return text;
      },
    },
  });

  flare.start();

  expect(() => {
    flare.tag("note", "unscrubbed tag");
    flare.context("upload", { note: "unscrubbed context" });
    flare.breadcrumb("step", { note: "unscrubbed breadcrumb" });
  }).not.toThrow();

  explode = false;
  flare.capture(new Error("boom"));

  expect(mock.submissions[0]?.report.tags).toEqual({});
  expect(mock.submissions[0]?.report.contexts).toEqual({});
  expect(mock.submissions[0]?.report.breadcrumbs).toEqual([]);
});

test("a schema failure costs only the invalid piece and is recorded on the report", () => {
  const mock = createMockAdapter();
  const schema = { tags: { area } } satisfies FlareSchema;
  const flare = new Flare({ destinations: { primary: mock.adapter }, schema });

  flare.start();

  const tags = JSON.parse('{"area":"billing"}');

  flare.capture(new Error("still reported"), { tags });

  expect(mock.submissions[0]?.report.tags).toEqual({});
  expect(mock.submissions[0]?.report).toMatchObject({
    exception: { message: "still reported" },
    losses: [{ path: "tags.area", reason: "invalid" }],
  });
});

test("capture reads each metadata option only once", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  const tags = vi.fn(() => ({ area: "upload" }));
  const contexts = vi.fn(() => ({ request: { attempt: 1 } }));
  const user = vi.fn(() => ({ id: "ada" }));
  const operation = vi.fn(() => "upload");
  const level = vi.fn(() => "warning");

  const options = Object.defineProperties(
    {},
    {
      tags: { get: tags },
      contexts: { get: contexts },
      user: { get: user },
      operation: { get: operation },
      level: { get: level },
    },
  );

  flare.message("Request failed", options);

  expect(mock.submissions[0]?.report).toMatchObject({
    tags: { area: "upload" },
    contexts: { request: { attempt: 1 } },
    identity: { user: { id: "ada" } },
    operation: "upload",
    level: "warning",
  });

  for (const read of [tags, contexts, user, operation, level]) {
    expect(read).toHaveBeenCalledTimes(1);
  }

  flare.dispose();
});

test("an oversized report is cut down to its limits and says what it lost", () => {
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    privacy: {
      limits: {
        messageLength: 20,
        stackLength: 40,
        breadcrumbs: 2,
        totalSize: 600,
      },
    },
  });

  flare.start();

  for (const step of ["one", "two", "three"]) {
    flare.breadcrumb(step, { pad: "p".repeat(150) });
  }

  const error = new Error("m".repeat(500));

  flare.capture(error, { contexts: { big: { blob: "b".repeat(400) } } });

  const report = mock.submissions[0]?.report;

  if (report?.kind !== "exception") {
    throw new Error("Expected an exception report.");
  }

  expect(report).toMatchObject({ exception: { message: "m".repeat(20) } });
  expect(report.exception.stack?.length).toBe(40);
  expect(JSON.stringify(report).length).toBeLessThan(900);
  expect(report?.losses.map((loss) => loss.path)).toEqual(
    expect.arrayContaining([
      "exception.message",
      "exception.stack",
      "breadcrumbs",
    ]),
  );
});

test("hostile thrown values are reported, never thrown back at the application", async () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  const circular = new Error("circular");

  circular.cause = circular;

  const getter = new Error("getter");

  Object.defineProperty(getter, "message", {
    get: () => {
      throw new Error("getter exploded");
    },
  });

  const hostile = [
    circular,
    getter,
    Promise.reject,
    null,
    undefined,
    "string rejection",
    42,
    { code: 1 },
  ];

  for (const thrown of hostile) {
    expect(() => flare.capture(thrown)).not.toThrow();
  }

  expect(mock.submissions).toHaveLength(hostile.length);
  expect(mock.submissions.map((submission) => submission.report.kind)).toEqual(
    hostile.map(() => "exception"),
  );
});

test("default redaction applies without any configuration", () => {
  const mock = createMockAdapter();
  const flare = new Flare({ destinations: { primary: mock.adapter } });

  flare.start();

  flare.capture(new Error("boom"), {
    contexts: { request: { password: "hunter2", path: "/login" } },
  });

  expect(mock.submissions[0]?.report.contexts).toEqual({
    request: { password: "[Redacted]", path: "/login" },
  });
});

test("schema inputs are transformed once before every metadata layer is retained", () => {
  const parseAttempt = vi.fn((input: string) => Number(input));
  const mock = createMockAdapter();

  const flare = new Flare({
    destinations: { primary: mock.adapter },
    schema: {
      tags: { attempt: z.string().transform(parseAttempt) },
      contexts: {
        upload: z.string().transform((id) => ({ id, token: SECRET })),
      },
      breadcrumbs: {
        opened: z.object({ page: z.string() }).default({ page: "home" }),
      },
    },
    defaults: { tags: { attempt: "1" } },
  });

  flare.tag("attempt", "2");
  flare.context("upload", "avatar");
  flare.breadcrumb("opened");

  const scope = flare.scope({ tags: { attempt: "3" } });

  scope.capture(new Error("first"), { tags: { attempt: "4" } });
  scope.message("second");
  flare.start();

  expect(parseAttempt.mock.calls.map(([input]) => input)).toEqual([
    "1",
    "2",
    "3",
    "4",
  ]);
  expect(mock.submissions.map(({ report }) => report.tags)).toEqual([
    { attempt: 4 },
    { attempt: 3 },
  ]);

  for (const { report } of mock.submissions) {
    expect(report.contexts).toEqual({
      upload: { id: "avatar", token: "[Redacted]" },
    });
    expect(report.breadcrumbs).toMatchObject([
      { name: "opened", data: { page: "home" } },
    ]);
    expect(report.losses).toEqual([]);
  }

  flare.dispose();
});
