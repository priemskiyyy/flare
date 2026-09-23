import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { Flare } from "@priemskiyyy/flare";
import { expect, test } from "vitest";

import { opentelemetry } from "src/opentelemetry";

const CAPTURED_AT = Date.UTC(2026, 8, 23, 12, 0, 0);

test("the real SDK keeps every attribute, with the record's severity, body and capture time", async () => {
  const exporter = new InMemoryLogRecordExporter();

  const provider = new LoggerProvider({
    processors: [new SimpleLogRecordProcessor({ exporter })],
  });

  const flare = new Flare({
    destinations: {
      otel: opentelemetry({
        logger: provider.getLogger("app"),
        forceFlush: () => provider.forceFlush(),
      }),
    },
    now: () => CAPTURED_AT,
  });

  flare.start();
  flare.user({ id: "ada" });
  flare.breadcrumb("opened", { screen: "cart" });

  const receipt = flare.capture(
    new TypeError("upload failed", { cause: new Error("disk full") }),
    {
      tags: { plan: "pro" },
      contexts: { upload: { kind: "avatar", retry: { count: 2 } } },
    },
  );

  await receipt.settled;
  await flare.flush();

  const [record] = exporter.getFinishedLogRecords();

  expect(record).toMatchObject({
    severityNumber: 17,
    severityText: "ERROR",
    body: "upload failed",
    hrTime: [CAPTURED_AT / 1_000, 0],
    droppedAttributesCount: 0,
    attributes: {
      "exception.type": "TypeError",
      "exception.message": "upload failed",
      "user.id": "ada",
      "flare.report_id": receipt.id,
      "flare.tags": { plan: "pro" },
      "flare.contexts": { upload: { kind: "avatar", retry: { count: 2 } } },
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

  await provider.shutdown();
});
