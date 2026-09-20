import type { RecordedEvent } from "src/utils/EventLog";
import type { RecordedEventKind } from "src/utils/getEventKind";

export type EventFilters = {
  destination: string | null;
  query: string;
  kind: RecordedEventKind | null;
};

export const filterEvents = (
  events: RecordedEvent[],
  filters: EventFilters,
) => {
  const query = filters.query.trim().toLowerCase();

  return events.filter((event) => {
    if (filters.kind !== null && event.kind !== filters.kind) {
      return false;
    }

    // Events that belong to no destination stay visible for a selected one: a
    // dropped report, or a Flare that never started, is usually why it saw nothing.
    const isOtherDestination =
      filters.destination !== null &&
      event.destination !== null &&
      event.destination !== filters.destination;

    if (isOtherDestination) {
      return false;
    }

    return `${event.type} ${event.destination ?? event.source} ${event.report ?? ""} ${event.summary} ${event.context}`
      .toLowerCase()
      .includes(query);
  });
};
