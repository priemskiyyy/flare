import { expect, test } from "vitest";

import type { RecordedEvent } from "src/utils/EventLog";
import { filterEvents } from "src/utils/filterEvents";

const recorded = (
  overrides: Partial<RecordedEvent> & Pick<RecordedEvent, "id" | "type">,
): RecordedEvent => ({
  source: "destination",
  destination: "sentry",
  report: "r_1",
  timestamp: 0,
  context: "{}",
  summary: "",
  kind: "DESTINATION",
  ...overrides,
});

const events = [
  recorded({ id: 1, type: "destination submit" }),
  recorded({
    id: 2,
    type: "destination outcome",
    kind: "ERROR",
    summary: "failed",
  }),
  recorded({ id: 3, type: "destination submit", destination: "backend" }),
  recorded({ id: 4, type: "destination outcome", report: "r_other" }),
  recorded({
    id: 5,
    type: "report dropped",
    source: "report",
    destination: null,
    kind: "ERROR",
    summary: "route-failed",
  }),
  recorded({
    id: 6,
    type: "started",
    source: "runtime",
    destination: null,
    report: null,
    kind: "RUNTIME",
  }),
];

const ids = (filtered: RecordedEvent[]) => filtered.map((entry) => entry.id);

test("a selected destination keeps its own events and the ones that belong to none", () => {
  const filtered = filterEvents(events, {
    destination: "sentry",
    query: "",
    kind: null,
  });

  // A dropped report, or a Flare that never started, is often why a destination saw nothing.
  expect(ids(filtered)).toEqual([1, 2, 4, 5, 6]);
});

test("the search matches type, destination, report and summary, and kinds narrow further", () => {
  const search = (query: string, kind: RecordedEvent["kind"] | null = null) =>
    ids(filterEvents(events, { destination: null, query, kind }));

  expect(search("FAILED")).toEqual([2, 5]);
  expect(search("backend")).toEqual([3]);
  expect(search("r_other")).toEqual([4]);
  expect(search("started")).toEqual([6]);
  expect(search("outcome", "ERROR")).toEqual([2]);
  expect(search("", "ERROR")).toEqual([2, 5]);
  expect(search("  ")).toEqual([1, 2, 3, 4, 5, 6]);
});
