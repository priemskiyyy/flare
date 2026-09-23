import type { FlareSnapshot } from "@priemskiyyy/flare";

import { DestinationList } from "src/components/Destinations/DestinationList";
import { PanelHeader } from "src/components/Panel/PanelHeader";
import { ResizeHandle } from "src/components/Panel/ResizeHandle";
import { Timeline } from "src/components/Timeline/Timeline";
import { useAutoFocus } from "src/hooks/useAutoFocus";
import { useEventFilters } from "src/hooks/useEventFilters";
import type { PanelPosition } from "src/types/PanelPosition";
import { assertUnreachable } from "src/utils/assertUnreachable";
import type { RecordedEvent } from "src/utils/EventLog";

// A panel docked to an edge is sized away from it.
const toPanelSize = (position: PanelPosition, size: number) => {
  if (position === "bottom") {
    return { height: `${size}px` };
  }

  if (position === "right") {
    return { width: `${size}px` };
  }

  return assertUnreachable(position);
};

type DevtoolsPanelProps = {
  snapshot: FlareSnapshot;
  events: RecordedEvent[];
  isPaused: boolean;
  /** False when the panel opened from stored preferences, so mounting never steals focus. */
  autoFocus: boolean;
  position: PanelPosition;
  /** Height when docked to the bottom, width when docked to the right. */
  size: number;
  onSizeChange: (size: number) => void;
  onDock: () => void;
  onTogglePause: () => void;
  onClear: () => void;
  onClose: () => void;
};

export const DevtoolsPanel = (props: DevtoolsPanelProps) => {
  const focusOnMount = useAutoFocus(props.autoFocus);
  const filters = useEventFilters(() => props.events);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") {
      return;
    }

    event.stopPropagation();
    props.onClose();
  };

  return (
    <aside
      ref={focusOnMount}
      tabIndex={-1}
      class="panel"
      data-position={props.position}
      aria-label="Flare devtools"
      style={toPanelSize(props.position, props.size)}
      onKeyDown={handleKeyDown}
    >
      <ResizeHandle
        position={props.position}
        size={props.size}
        onSizeChange={(size) => props.onSizeChange(size)}
      />
      <PanelHeader
        snapshot={props.snapshot}
        position={props.position}
        onDock={() => props.onDock()}
        onClose={() => props.onClose()}
      />
      <div class="body">
        <DestinationList
          destinations={props.snapshot.destinations}
          selected={filters.filters().destination}
          onSelect={(destination) => filters.update({ destination })}
        />
        <div class="main">
          <Timeline
            events={props.events}
            isPaused={props.isPaused}
            filters={filters}
            onTogglePause={() => props.onTogglePause()}
            onClear={() => props.onClear()}
          >
            <Timeline.Toolbar />
            <Timeline.Kinds />
            <Timeline.Rows emptyState={<Timeline.Empty />} />
          </Timeline>
        </div>
      </div>
    </aside>
  );
};
