import { Broadcast } from "@phosphor-icons/react";
import type React from "react";

import { formatAccount } from "examples/shared/ledger/formatting/formatAccount";
import { formatClockTime } from "examples/shared/ledger/formatting/formatClockTime";
import { formatShortId } from "examples/shared/ledger/formatting/formatShortId";
import type { LedgerRuntime } from "examples/shared/ledger/types/LedgerRuntime";
import { ReceiptStateBadge } from "src/components/Badge/ReceiptStateBadge";
import { EmptyState } from "src/components/EmptyState/EmptyState";
import { Panel } from "src/components/Panel/Panel";
import { ReportDetails } from "src/components/Report/ReportDetails";
import { useEventLog } from "src/hooks/useEventLog";

type LatestReportPanelProps = { runtime: LedgerRuntime };

const LatestReport: React.FunctionComponent<LatestReportPanelProps> = ({
  runtime,
}) => {
  const [latest] = useEventLog(runtime.receipts);

  // The console destination sees every report, which is how its payload is known here.
  useEventLog(runtime.consoleLines);

  if (latest === undefined) {
    return (
      <EmptyState
        icon={Broadcast}
        title="Nothing reported yet"
        description="Press any button in Ledger. Each one fails on purpose, and its report lands here."
      />
    );
  }

  // Keyed by the report, so each new one mounts afresh and flashes.
  return (
    <div
      key={latest.receipt.id}
      className="-m-2 flex animate-flash flex-col gap-4 rounded-xl p-2 motion-reduce:animate-none"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-semibold tracking-tight">
            {latest.action}
          </p>
          <ReceiptStateBadge receipt={latest.receipt} />
        </div>
        <p className="text-sm text-stone-500">
          {formatAccount(latest.account)} · {formatClockTime(latest.at)} ·{" "}
          <span className="font-mono">{formatShortId(latest.receipt.id)}</span>
        </p>
      </div>
      <ReportDetails
        receipt={latest.receipt}
        report={runtime.findReport(latest.receipt.id)}
      />
    </div>
  );
};

export const LatestReportPanel: React.FunctionComponent<
  LatestReportPanelProps
> = ({ runtime }) => (
  <Panel
    title="Latest report"
    icon={Broadcast}
    shows="Where the last thing you did went: every destination, what it answered, and why."
    aside={null}
  >
    <LatestReport runtime={runtime} />
  </Panel>
);
