import { useTimeline } from "src/components/Timeline/useTimeline";

export const TimelineToolbar = () => {
  const timeline = useTimeline();

  return (
    <div class="toolbar">
      <input
        aria-label="Filter events"
        type="search"
        placeholder="Filter by type, destination, report, or detail…"
        value={timeline.filters.filters().query}
        onInput={(event) =>
          timeline.filters.update({ query: event.currentTarget.value })
        }
      />
      <button
        type="button"
        aria-pressed={timeline.isPaused()}
        onClick={() => timeline.onTogglePause()}
      >
        {timeline.isPaused() ? "Resume" : "Pause"}
      </button>
      <button type="button" onClick={() => timeline.onClear()}>
        Clear
      </button>
      <span class="total">
        {timeline.filters.visibleEvents().length} / {timeline.events().length}
      </span>
    </div>
  );
};
