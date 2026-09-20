import { Flare } from "@priemskiyyy/flare";
import { afterEach, expect, test, vi } from "vitest";

import { consoleReporter } from "src/consoleReporter";
import type { ConsoleWriter } from "src/types/ConsoleWriter";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const SECRET = "sk_live_12345";

test.each([
  null,
  {},
  { error: () => {}, warn: "not callable", info: () => {} },
])(
  "an incomplete console is unavailable unless a writer was supplied: %s",
  (value) => {
    vi.stubGlobal("console", value);

    expect(consoleReporter().available().available).toBe(false);
    expect(consoleReporter({ writer: () => {} }).available().available).toBe(
      true,
    );
  },
);

test("creating the adapter writes nothing and touches no console", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const writer = vi.fn();

  consoleReporter({ writer });
  consoleReporter();

  expect(writer).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});

test("an injected writer receives the level, a one line summary and the sanitized report", () => {
  const writer = vi.fn<ConsoleWriter>();
  const flare = new Flare({
    destinations: { console: consoleReporter({ writer }) },
  });
  flare.start();

  flare.capture(new Error("upload failed"), { tags: { area: "upload" } });

  expect(writer).toHaveBeenCalledTimes(1);
  expect(writer.mock.calls[0]?.[0]).toMatchObject({
    level: "error",
    line: "[flare] error Error: upload failed",
    report: { kind: "exception", tags: { area: "upload" } },
  });
});

test("what reaches the writer is already redacted", () => {
  const writer = vi.fn<ConsoleWriter>();
  const flare = new Flare({
    destinations: { console: consoleReporter({ writer }) },
    privacy: { scrub: (text) => text.replaceAll(SECRET, "[key]") },
  });
  flare.start();

  flare.capture(new Error(`charge failed for ${SECRET}`), {
    contexts: { request: { authorization: `Bearer ${SECRET}` } },
  });

  expect(JSON.stringify(writer.mock.calls)).not.toContain(SECRET);
  expect(writer.mock.calls[0]?.[0].line).toBe(
    "[flare] error Error: charge failed for [key]",
  );
});

test.each([
  { level: "fatal", method: "error" },
  { level: "error", method: "error" },
  { level: "warning", method: "warn" },
  { level: "info", method: "info" },
] as const)(
  "without a writer a $level report goes to console.$method",
  (row) => {
    const method = vi.spyOn(console, row.method).mockImplementation(() => {});
    const flare = new Flare({ destinations: { console: consoleReporter() } });
    flare.start();

    flare.message("note", { level: row.level });

    expect(method).toHaveBeenCalledTimes(1);
    expect(method.mock.calls[0]?.[0]).toBe(`[flare] ${row.level} note`);
    expect(method.mock.calls[0]?.[1]).toMatchObject({
      kind: "message",
      message: "note",
    });
  },
);

test("a console that forwards its errors back into Flare cannot start a feedback loop", async () => {
  const printed: unknown[] = [];
  const flare = new Flare({ destinations: { console: consoleReporter() } });
  const forwarded: Array<ReturnType<typeof flare.capture>> = [];
  // What console instrumentation does: every console.error becomes a report.
  vi.spyOn(console, "error").mockImplementation((...parameters) => {
    printed.push(parameters[0]);
    forwarded.push(flare.capture(new Error(String(parameters[0]))));
  });
  flare.start();

  flare.capture(new Error("original"));

  expect(printed).toEqual(["[flare] error Error: original"]);
  await expect(forwarded[0]?.settled).resolves.toEqual({
    state: "dropped",
    reason: "reentrant",
  });
});

test("a writer that throws is a failed outcome and never reaches the application", async () => {
  const failure = new Error("writer exploded");
  const flare = new Flare({
    destinations: {
      console: consoleReporter({
        writer: () => {
          throw failure;
        },
      }),
    },
  });
  flare.start();

  await expect(flare.capture(new Error("boom")).settled).resolves.toEqual({
    state: "settled",
    outcomes: { console: { status: "failed", error: failure } },
  });
});

test("an asynchronous writer keeps the receipt pending until it finishes", async () => {
  let finish = () => {};
  const writing = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const flare = new Flare({
    destinations: { console: consoleReporter({ writer: () => writing }) },
  });
  flare.start();
  const receipt = flare.message("queued write");

  expect(receipt.status.get().state).toBe("pending");
  finish();
  await expect(receipt.settled).resolves.toMatchObject({
    state: "settled",
    outcomes: { console: { status: "submitted" } },
  });
});

test("an asynchronous writer failure is reflected in its receipt", async () => {
  const failure = new Error("async writer failed");
  const writing = Promise.reject(failure);
  // Observe the fixture's rejection even if the adapter forgets to await it.
  writing.catch(() => {});
  const flare = new Flare({
    destinations: { console: consoleReporter({ writer: () => writing }) },
  });
  flare.start();

  await expect(flare.message("queued write").settled).resolves.toEqual({
    state: "settled",
    outcomes: { console: { status: "failed", error: failure } },
  });
});

test("the native handle is the writer in use", () => {
  const writer = vi.fn<ConsoleWriter>();
  const flare = new Flare({
    destinations: { console: consoleReporter({ writer }) },
  });
  flare.start();

  expect(flare.destination("console").native).toBe(writer);
});

test("where there is no console and no writer the destination is unavailable", () => {
  vi.stubGlobal("console", undefined);

  expect(consoleReporter().available()).toEqual({
    available: false,
    reason: "No console is available. Pass a writer to consoleReporter().",
  });
  expect(consoleReporter({ writer: () => {} }).available()).toEqual({
    available: true,
  });

  vi.unstubAllGlobals();
});
