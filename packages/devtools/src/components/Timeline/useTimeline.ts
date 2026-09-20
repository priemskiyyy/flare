import { createContext, useContext } from "solid-js";
import type { Accessor } from "solid-js";

import type { EventFilterControls } from "src/hooks/useEventFilters";
import type { RecordedEvent } from "src/utils/EventLog";

export type TimelineContextValue = {
  events: Accessor<RecordedEvent[]>;
  isPaused: Accessor<boolean>;
  filters: EventFilterControls;
  onTogglePause: () => void;
  onClear: () => void;
};

export const TimelineContext = createContext<TimelineContextValue>();

export const useTimeline = () => {
  const timeline = useContext(TimelineContext);

  if (timeline === undefined) {
    throw new Error("Timeline parts must be rendered inside <Timeline>.");
  }

  return timeline;
};
