import type { RecordedEvent } from "src/utils/EventLog";
import type { RecordedEventKind } from "src/utils/getEventKind";

export const countEventsByKind = (events: RecordedEvent[]) => {
  const counts: Record<RecordedEventKind, number> = {
    ERROR: 0,
    REPORT: 0,
    DESTINATION: 0,
    SESSION: 0,
    RUNTIME: 0,
  };

  for (const event of events) {
    counts[event.kind] += 1;
  }

  return counts;
};
