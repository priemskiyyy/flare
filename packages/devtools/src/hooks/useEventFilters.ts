import { createMemo, createSignal } from "solid-js";
import type { Accessor } from "solid-js";

import type { RecordedEvent } from "src/utils/EventLog";
import { filterEvents } from "src/utils/filterEvents";
import type { EventFilters } from "src/utils/filterEvents";

const NO_FILTERS: EventFilters = { destination: null, query: "", kind: null };

export const useEventFilters = (events: Accessor<RecordedEvent[]>) => {
  const [filters, setFilters] = createSignal(NO_FILTERS);
  const visibleEvents = createMemo(() => filterEvents(events(), filters()));

  const isFiltered = createMemo(() => {
    const { destination, query, kind } = filters();

    return destination !== null || query.trim() !== "" || kind !== null;
  });

  const update = (patch: Partial<EventFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  const clear = () => {
    setFilters(NO_FILTERS);
  };

  return { filters, visibleEvents, isFiltered, update, clear };
};

export type EventFilterControls = ReturnType<typeof useEventFilters>;
