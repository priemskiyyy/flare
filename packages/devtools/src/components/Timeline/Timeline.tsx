import type { ParentProps } from "solid-js";

import { TimelineEmpty } from "src/components/Timeline/TimelineEmpty";
import { TimelineKinds } from "src/components/Timeline/TimelineKinds";
import { TimelineRows } from "src/components/Timeline/TimelineRows";
import { TimelineToolbar } from "src/components/Timeline/TimelineToolbar";
import { TimelineContext } from "src/components/Timeline/useTimeline";
import type { TimelineContextValue } from "src/components/Timeline/useTimeline";
import type { EventFilterControls } from "src/hooks/useEventFilters";
import type { RecordedEvent } from "src/utils/EventLog";

type TimelineProps = ParentProps<{
  events: RecordedEvent[];
  isPaused: boolean;
  filters: EventFilterControls;
  onTogglePause: () => void;
  onClear: () => void;
}>;

/** The event area. The parent owns the layout; the parts share recording state and filters through context. */
const TimelineRoot = (props: TimelineProps) => {
  const value: TimelineContextValue = {
    events: () => props.events,
    isPaused: () => props.isPaused,
    filters: props.filters,
    onTogglePause: () => props.onTogglePause(),
    onClear: () => props.onClear(),
  };

  return (
    <TimelineContext.Provider value={value}>
      <div class="timeline">{props.children}</div>
    </TimelineContext.Provider>
  );
};

export const Timeline = Object.assign(TimelineRoot, {
  Toolbar: TimelineToolbar,
  Kinds: TimelineKinds,
  Rows: TimelineRows,
  Empty: TimelineEmpty,
});
