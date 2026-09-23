import { ClockCounterClockwise, Play, Power } from "@phosphor-icons/react";
import { useFlareStatus } from "@priemskiyyy/flare-react";
import type React from "react";

import { EmptyState } from "src/components/EmptyState/EmptyState";
import { Panel } from "src/components/Panel/Panel";
import { TimelineRow } from "src/components/Timeline/TimelineRow";
import { useEventLog } from "src/hooks/useEventLog";
import { buttonStyles } from "src/styles/buttonStyles";
import type { LedgerRuntime } from "src/types/LedgerRuntime";

type TimelinePanelProps = {
  runtime: LedgerRuntime;
  onRestartPress: () => void;
  onRestartUnstartedPress: () => void;
  onStartPress: () => void;
};

export const TimelinePanel: React.FunctionComponent<TimelinePanelProps> = ({
  runtime,
  onRestartPress,
  onRestartUnstartedPress,
  onStartPress,
}) => {
  const status = useFlareStatus();
  const entries = useEventLog(runtime.timeline);

  return (
    <Panel
      title="Timeline"
      icon={ClockCounterClockwise}
      shows="What Flare's diagnostics said, newest first. They carry ids, reasons and counts, never report content."
      aside={
        <>
          <button
            type="button"
            onClick={onRestartPress}
            className={buttonStyles({ size: "small" })}
          >
            <Power aria-hidden="true" size={14} weight="bold" />
            Restart
          </button>
          <button
            type="button"
            onClick={onRestartUnstartedPress}
            className={buttonStyles({ size: "small" })}
          >
            <Power aria-hidden="true" size={14} weight="bold" />
            Restart without starting
          </button>
          <button
            type="button"
            onClick={onStartPress}
            disabled={status.state === "disposed"}
            className={buttonStyles({ size: "small" })}
          >
            <Play aria-hidden="true" size={14} weight="bold" />
            Start
          </button>
        </>
      }
    >
      {entries.length === 0 ? (
        <EmptyState
          icon={ClockCounterClockwise}
          title="Nothing recorded yet"
          description="Destinations opening, reports accepted, outcomes and account changes appear here."
        />
      ) : (
        <ol
          aria-label="Timeline events"
          className="flex max-h-[28rem] flex-col divide-y divide-stone-200/70 overflow-y-auto text-sm dark:divide-stone-800"
        >
          {entries.map((entry) => (
            <TimelineRow key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
    </Panel>
  );
};
