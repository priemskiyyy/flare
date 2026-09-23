import { Eraser, Receipt } from "@phosphor-icons/react";
import type React from "react";

import { EmptyState } from "src/components/EmptyState/EmptyState";
import { Panel } from "src/components/Panel/Panel";
import { ReceiptRow } from "src/components/Receipts/ReceiptRow";
import { OutcomeLegend } from "src/components/Report/OutcomeLegend";
import { useEventLog } from "src/hooks/useEventLog";
import { buttonStyles } from "src/styles/buttonStyles";
import type { LedgerRuntime } from "src/types/LedgerRuntime";

type ReceiptsPanelProps = { runtime: LedgerRuntime };

export const ReceiptsPanel: React.FunctionComponent<ReceiptsPanelProps> = ({
  runtime,
}) => {
  const receipts = useEventLog(runtime.receipts);

  // The console destination sees every report, which is how its payload is known here.
  useEventLog(runtime.consoleLines);

  return (
    <Panel
      title="Receipts"
      icon={Receipt}
      shows="Every report, newest first. Open one to see what each destination answered, and the report they received."
      aside={
        <button
          type="button"
          disabled={receipts.length === 0}
          onClick={runtime.receipts.clear}
          className={buttonStyles({ size: "small" })}
        >
          <Eraser aria-hidden="true" size={14} weight="bold" />
          Clear
        </button>
      }
    >
      {receipts.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No reports yet"
          description="Everything you report stays listed here, so you can compare two reports side by side."
        />
      ) : (
        <ol
          aria-label="Receipts"
          className="flex max-h-[36rem] flex-col divide-y divide-stone-200/70 overflow-y-auto dark:divide-stone-800"
        >
          {receipts.map((tracked) => (
            <ReceiptRow
              key={tracked.receipt.id}
              tracked={tracked}
              report={runtime.findReport(tracked.receipt.id)}
            />
          ))}
        </ol>
      )}
      <OutcomeLegend />
    </Panel>
  );
};
