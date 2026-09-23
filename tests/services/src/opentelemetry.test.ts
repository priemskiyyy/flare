import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { Flare } from "@priemskiyyy/flare";
import { opentelemetry } from "@priemskiyyy/flare-opentelemetry";
import { existsSync, readFileSync } from "node:fs";
import { beforeAll, expect, onTestFinished, test } from "vitest";

import { decodeValue } from "src/decodeValue";
import { readField } from "src/readField";

const COLLECTOR = "http://127.0.0.1:54318";
const HEALTH = "http://127.0.0.1:54313";
const OUTPUT = new URL("../.output/logs.jsonl", import.meta.url);
const CAPTURED_AT = Date.UTC(2026, 8, 23, 12, 0, 0);

// The image has no health check of its own, so Compose reports the container
// running before the collector listens. Wait for its health endpoint.
beforeAll(async () => {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const response = await fetch(HEALTH).catch(() => null);

    if (response !== null && response.ok) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(
    "The collector is not running. Start it with `pnpm --filter test-services services:up`.",
  );
});

const readFirst = (value: unknown): unknown => {
  if (!Array.isArray(value)) {
    return null;
  }

  return value[0];
};

/**
 * The record the collector wrote for a report, one OTLP JSON export per line,
 * with its body and attributes decoded into plain values.
 */
const readRecord = (reportId: string) => {
  if (!existsSync(OUTPUT)) {
    return null;
  }

  const line = readFileSync(OUTPUT, "utf8")
    .split("\n")
    .find((candidate) => candidate.includes(reportId));

  if (line === undefined) {
    return null;
  }

  // Each export holds one record: the processor exports as each is emitted.
  const resourceLog = readFirst(readField(JSON.parse(line), "resourceLogs"));
  const scopeLog = readFirst(readField(resourceLog, "scopeLogs"));
  const record = readFirst(readField(scopeLog, "logRecords"));

  return {
    scope: readField(readField(scopeLog, "scope"), "name"),
    timeUnixNano: readField(record, "timeUnixNano"),
    severityNumber: readField(record, "severityNumber"),
    severityText: readField(record, "severityText"),
    body: decodeValue(readField(record, "body")),
    attributes: decodeValue({
      kvlistValue: { values: readField(record, "attributes") },
    }),
    raw: line,
  };
};

const createFlare = () => {
  const provider = new LoggerProvider({
    processors: [
      new SimpleLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: `${COLLECTOR}/v1/logs` }),
      }),
    ],
  });

  const flare = new Flare({
    destinations: {
      otel: opentelemetry({
        logger: provider.getLogger("ledger"),
        forceFlush: () => provider.forceFlush(),
      }),
    },
    now: () => CAPTURED_AT,
  });

  onTestFinished(async () => {
    flare.dispose();
    await provider.shutdown();
  });
  flare.start();

  return flare;
};

test("the collector receives the record with its severity, body, capture time and every attribute, nested and redacted", async () => {
  const flare = createFlare();

  flare.user({ id: "ada" });
  flare.breadcrumb("opened", { screen: "cart" });

  const receipt = flare.capture(
    new TypeError("upload failed", { cause: new Error("disk full") }),
    {
      tags: { plan: "pro" },
      contexts: {
        upload: { kind: "avatar", retry: { count: 2 } },
        payment: { cardToken: "tok_live_4242" },
      },
    },
  );

  await expect(receipt.settled).resolves.toMatchObject({
    outcomes: { otel: { status: "submitted" } },
  });
  await expect(flare.flush()).resolves.toMatchObject({
    destinations: { otel: { status: "flushed" } },
  });
  await expect.poll(() => readRecord(receipt.id)).not.toBeNull();

  const record = readRecord(receipt.id);

  expect(record?.raw).not.toContain("tok_live_4242");
  expect(record).toMatchObject({
    scope: "ledger",
    timeUnixNano: `${CAPTURED_AT}000000`,
    severityNumber: 17,
    severityText: "ERROR",
    body: "upload failed",
    attributes: {
      "exception.type": "TypeError",
      "exception.message": "upload failed",
      "user.id": "ada",
      "flare.report_id": receipt.id,
      "flare.tags": { plan: "pro" },
      "flare.contexts": {
        upload: { kind: "avatar", retry: { count: 2 } },
        payment: { cardToken: "[Redacted]" },
      },
      "flare.breadcrumbs": [
        {
          name: "opened",
          data: { screen: "cart" },
          timestamp: "2026-09-23T12:00:00.000Z",
        },
      ],
      "flare.causes": [{ name: "Error", message: "disk full" }],
    },
  });
});

test("a message arrives at its own severity, with its text as the body", async () => {
  const flare = createFlare();

  const receipt = flare.message("The reminder bounced", { level: "warning" });

  await receipt.settled;
  await flare.flush();
  await expect.poll(() => readRecord(receipt.id)).not.toBeNull();
  expect(readRecord(receipt.id)).toMatchObject({
    severityNumber: 13,
    severityText: "WARN",
    body: "The reminder bounced",
    attributes: { "flare.report_id": receipt.id },
  });
});
