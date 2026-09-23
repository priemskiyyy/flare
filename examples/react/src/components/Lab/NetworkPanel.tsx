import { Eraser, Terminal } from "@phosphor-icons/react";
import type React from "react";

import { REQUEST_LABELS } from "examples/shared/ledger/constants/labels";
import { formatDuration } from "examples/shared/ledger/formatting/formatDuration";
import type { ReportBackend } from "examples/shared/ledger/types/ReportBackend";
import { REQUEST_TONES } from "examples/shared/ui/constants/tones";
import { buttonStyles } from "examples/shared/ui/styles/buttonStyles";
import { Badge } from "src/components/Badge/Badge";
import { EmptyState } from "src/components/EmptyState/EmptyState";
import { Panel } from "src/components/Panel/Panel";
import { useEventLog } from "src/hooks/useEventLog";

type NetworkPanelProps = { backend: ReportBackend };

export const NetworkPanel: React.FunctionComponent<NetworkPanelProps> = ({
  backend,
}) => {
  const requests = useEventLog(backend.requests);

  return (
    <Panel
      title="Network"
      icon={Terminal}
      shows="What your API received from the HTTP adapter, newest first. The report id is the idempotency key."
      aside={
        <button
          type="button"
          disabled={requests.length === 0}
          onClick={backend.requests.clear}
          className={buttonStyles({ size: "small" })}
        >
          <Eraser aria-hidden="true" size={14} weight="bold" />
          Clear
        </button>
      }
    >
      {requests.length === 0 ? (
        <EmptyState
          icon={Terminal}
          title="No requests yet"
          description="Billing reports go to your API. Pay an invoice to send one."
        />
      ) : (
        <ol
          aria-label="Requests"
          className="flex max-h-[28rem] flex-col divide-y divide-stone-200/70 overflow-y-auto text-sm dark:divide-stone-800"
        >
          {requests.map((request) => (
            <li
              key={request.id}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2.5"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-mono">
                  <span className="font-semibold">POST</span> /api/error-reports
                </span>
                <span className="truncate font-mono text-xs text-stone-500">
                  {request.reportId} · {request.account ?? "anonymous"}
                </span>
              </span>
              <Badge tone={REQUEST_TONES[request.outcome]}>
                {REQUEST_LABELS[request.outcome]}
              </Badge>
              <span className="w-16 text-right font-mono text-stone-500 tabular-nums">
                {formatDuration(request.duration)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
};
