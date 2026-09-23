import type React from "react";

import { Badge } from "src/components/Badge/Badge";
import { describeTimelineEntry } from "src/formatting/describeTimelineEntry";
import { formatClockTime } from "src/formatting/formatClockTime";
import type { TimelineEntry } from "src/types/TimelineEntry";

type TimelineRowProps = { entry: TimelineEntry };

export const TimelineRow: React.FunctionComponent<TimelineRowProps> = ({
  entry,
}) => {
  const { text, tone } = describeTimelineEntry(entry);

  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 py-2">
      <time
        dateTime={new Date(entry.timestamp).toISOString()}
        className="font-mono text-xs text-stone-500 tabular-nums"
      >
        {formatClockTime(entry.timestamp)}
      </time>
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge tone={tone}>{entry.source}</Badge>
        <span className="min-w-0">{text}</span>
      </span>
    </li>
  );
};
