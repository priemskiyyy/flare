import type { DestinationOutcome } from "@priemskiyyy/flare";
import type React from "react";

import { DestinationOutcomeRow } from "src/components/Report/DestinationOutcomeRow";
import type { LedgerDestination } from "src/types/LedgerDestination";
import { DESTINATION_NAMES } from "src/utils/constants/destinations";

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
