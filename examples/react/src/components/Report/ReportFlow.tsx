import type { DestinationOutcome } from "@priemskiyyy/flare";
import type React from "react";

import { DESTINATION_NAMES } from "examples/shared/ledger/constants/destinations";
import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import { DestinationOutcomeRow } from "src/components/Report/DestinationOutcomeRow";

type ReportFlowProps = {
  outcomes: Partial<Record<LedgerDestination, DestinationOutcome | null>>;
};

/** Every destination, so the ones routing left out show as plainly as the ones it chose. */
export const ReportFlow: React.FunctionComponent<ReportFlowProps> = ({
  outcomes,
}) => (
  <ul
    aria-label="Destination outcomes"
    className="flex flex-col divide-y divide-stone-200/70 dark:divide-stone-800"
  >
    {DESTINATION_NAMES.map((destination) => (
      <DestinationOutcomeRow
        key={destination}
        destination={destination}
        outcome={outcomes[destination]}
      />
    ))}
  </ul>
);
