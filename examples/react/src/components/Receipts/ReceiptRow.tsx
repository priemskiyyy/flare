import { CaretRight } from "@phosphor-icons/react";
import type { Receipt, SanitizedReport } from "@priemskiyyy/flare";
import type React from "react";

import {
  DESTINATION_GUIDES,
  DESTINATION_NAMES,
} from "examples/shared/ledger/constants/destinations";
import { OUTCOME_LABELS } from "examples/shared/ledger/constants/labels";
import { formatAccount } from "examples/shared/ledger/formatting/formatAccount";
import { formatClockTime } from "examples/shared/ledger/formatting/formatClockTime";
import { formatShortId } from "examples/shared/ledger/formatting/formatShortId";
import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import type { TrackedReceipt } from "examples/shared/ledger/types/TrackedReceipt";
import { getOutcomeStatus } from "examples/shared/ledger/utils/getOutcomeStatus";
import { OUTCOME_TONES } from "examples/shared/ui/constants/tones";
import { Badge } from "src/components/Badge/Badge";
import { OutcomeIcon } from "src/components/Badge/OutcomeIcon";
import { ReceiptStateBadge } from "src/components/Badge/ReceiptStateBadge";
import { ReportDetails } from "src/components/Report/ReportDetails";
import { useObservable } from "src/hooks/useObservable";

type ReceiptRowProps = {
  tracked: TrackedReceipt;
  report: SanitizedReport | null;
};

const RoutedDestinations: React.FunctionComponent<{
  receipt: Receipt<LedgerDestination>;
}> = ({ receipt }) => {
  const status = useObservable(receipt.status);

  if (status.state === "dropped") {
    return null;
  }

  return (
    <span className="flex flex-wrap gap-1.5">
      {DESTINATION_NAMES.filter(
        (name) => status.outcomes[name] !== undefined,
      ).map((name) => {
        const outcome = getOutcomeStatus(status.outcomes[name]);

        return (
          <Badge key={name} tone={OUTCOME_TONES[outcome]}>
            <OutcomeIcon status={outcome} />
            {DESTINATION_GUIDES[name].name}
            <span className="sr-only">: {OUTCOME_LABELS[outcome]}</span>
          </Badge>
        );
      })}
    </span>
  );
};

export const ReceiptRow: React.FunctionComponent<ReceiptRowProps> = ({
  tracked,
  report,
}) => (
  <li>
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg px-2 py-3 hover:bg-stone-100/70 dark:hover:bg-stone-800/50 [&::-webkit-details-marker]:hidden">
        <CaretRight
          aria-hidden="true"
          size={14}
          weight="bold"
          className="shrink-0 text-stone-400 transition-transform group-open:rotate-90 motion-reduce:transition-none"
        />
        <span className="font-semibold">{tracked.action}</span>
        <ReceiptStateBadge receipt={tracked.receipt} />
        <span className="text-sm text-stone-500">
          {formatAccount(tracked.account)} · {formatClockTime(tracked.at)} ·{" "}
          <span className="font-mono">{formatShortId(tracked.receipt.id)}</span>
        </span>
        <span className="flex w-full pl-5 lg:ml-auto lg:w-auto lg:pl-0">
          <RoutedDestinations receipt={tracked.receipt} />
        </span>
      </summary>
      <div className="px-2 pb-4 sm:pl-7">
        <ReportDetails receipt={tracked.receipt} report={report} />
      </div>
    </details>
  </li>
);
