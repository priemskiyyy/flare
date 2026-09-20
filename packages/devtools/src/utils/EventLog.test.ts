import type { FlareDiagnosticEvent } from "@priemskiyyy/flare";
import { expect, test } from "vitest";

import { EventLog } from "src/utils/EventLog";

const event = (
  type: string,
  context: unknown = null,
): FlareDiagnosticEvent => ({
  source: "destination",
  type,
  destination: "primary",
  report: "r_1",
  timestamp: 1_000,
  context,
});

test("keeps the newest events first within a clamped limit and notifies once per microtask", async () => {
  const log = new EventLog(0);
  let notifications = 0;
  log.subscribe(() => {
    notifications += 1;
  });

  log.add(event("destination starting"));
  log.add(event("destination ready"));
  expect(log.get().map((entry) => entry.type)).toEqual(["destination ready"]);
  expect(notifications).toBe(0);

  await Promise.resolve();
  expect(notifications).toBe(1);

  log.setLimit(5_000);
  log.add(event("destination submit"));
  log.add(event("destination outcome", { status: "submitted" }));
  expect(log.get()).toHaveLength(3);
  expect(log.get().map((entry) => entry.id)).toEqual([4, 3, 2]);

  log.setLimit(1);
  expect(log.get().map((entry) => entry.type)).toEqual(["destination outcome"]);
  log.clear();
  expect(log.get()).toEqual([]);
});

test("a limit that is not a number falls back instead of throwing into the host", () => {
  const log = new EventLog(Number.NaN);
  for (let index = 0; index < 250; index += 1) {
    log.add(event("destination submit"));
  }

  expect(log.get()).toHaveLength(200);
});

test("records the description alongside the event", () => {
  const log = new EventLog(10);
  log.add(
    event("destination outcome", {
      status: "dropped",
      reason: "deduped",
      losses: 0,
    }),
  );

  const [recorded] = log.get();
  expect(recorded?.kind).toBe("ERROR");
  expect(recorded?.summary).toBe("dropped · deduped");
  expect(recorded?.context).toContain('"reason": "deduped"');
});

test("an observer removed by an earlier one during a notification is not called", async () => {
  const log = new EventLog(10);
  const calls: string[] = [];
  let stopSecond = () => {};
  log.subscribe(() => {
    calls.push("first");
    stopSecond();
  });
  stopSecond = log.subscribe(() => {
    calls.push("second");
  });

  log.add(event("destination ready"));
  await Promise.resolve();

  expect(calls).toEqual(["first"]);
});
