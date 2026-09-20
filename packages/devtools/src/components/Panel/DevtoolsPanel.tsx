import { Show, createMemo } from "solid-js";
import type { FlareSnapshot } from "@priemskiyyy/flare";

import { DestinationDetail } from "src/components/Destinations/DestinationDetail";
import { DestinationList } from "src/components/Destinations/DestinationList";
import { PanelHeader } from "src/components/Panel/PanelHeader";
import { ResizeHandle } from "src/components/Panel/ResizeHandle";
import { Timeline } from "src/components/Timeline/Timeline";
import { useAutoFocus } from "src/hooks/useAutoFocus";
import { useEventFilters } from "src/hooks/useEventFilters";
import type { PanelPosition } from "src/types/PanelPosition";
import type { RecordedEvent } from "src/utils/EventLog";

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
  // The selection names a destination; the snapshot says whether it still exists.
  const selectedDestination = createMemo(() => {
    const selected = filters.filters().destination;

    if (selected === null) {
      return null;
    }

    return (
      props.snapshot.destinations.find(
        (destination) => destination.name === selected,
      ) ?? null
    );
  });

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
      style={
        props.position === "bottom"
          ? { height: `${props.size}px` }
          : { width: `${props.size}px` }
      }
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
          <Show when={selectedDestination()}>
            {(destination) => (
              <DestinationDetail
                destination={destination()}
                onClose={() => filters.update({ destination: null })}
              />
            )}
          </Show>
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
