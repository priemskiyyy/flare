import type { DestinationOutcome } from "@priemskiyyy/flare";
import clsx from "clsx";
import type React from "react";

import { OutcomeBadge } from "src/components/Badge/OutcomeBadge";
import { explainOutcome } from "src/formatting/explainOutcome";
import { CODE_CLASS_NAME } from "src/styles/codeStyles";
import type { LedgerDestination } from "src/types/LedgerDestination";
import { DESTINATION_GUIDES } from "src/utils/constants/destinations";
import { DESTINATION_ICONS } from "src/utils/constants/icons";
import { getOutcomeCode } from "src/utils/getOutcomeCode";
import { getOutcomeStatus } from "src/utils/getOutcomeStatus";

type DestinationOutcomeRowProps = {
  destination: LedgerDestination;
  /** `undefined` when routing left this destination out, `null` until it answers. */
  outcome: DestinationOutcome | null | undefined;
};

const OutcomeCode: React.FunctionComponent<{
  outcome: DestinationOutcome | null | undefined;
}> = ({ outcome }) => {
  const code = getOutcomeCode(outcome);

  if (code === null) {
    return null;
  }

  return <code className={CODE_CLASS_NAME}>{code}</code>;
};

export const DestinationOutcomeRow: React.FunctionComponent<
  DestinationOutcomeRowProps
> = ({ destination, outcome }) => {
  const DestinationIcon = DESTINATION_ICONS[destination];
  const { name } = DESTINATION_GUIDES[destination];

  return (
    <li
      aria-label={name}
      className={clsx("flex items-start gap-3 py-3", {
        "opacity-60": outcome === undefined,
      })}
    >
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
      >
        <DestinationIcon size={16} weight="duotone" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="font-medium">{name}</span>
          <OutcomeBadge status={getOutcomeStatus(outcome)} />
        </div>
        <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          {explainOutcome(destination, outcome)}{" "}
          <OutcomeCode outcome={outcome} />
        </p>
      </div>
    </li>
  );
};
