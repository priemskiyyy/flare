import clsx from "clsx";
import type React from "react";

import type { OutcomeStatus } from "examples/shared/ledger/types/OutcomeStatus";
import { OUTCOME_ICONS } from "src/utils/constants/icons";

type OutcomeIconProps = { status: OutcomeStatus };

export const OutcomeIcon: React.FunctionComponent<OutcomeIconProps> = ({
  status,
}) => {
  const StatusIcon = OUTCOME_ICONS[status];

  return (
    <StatusIcon
      aria-hidden="true"
      size={12}
      weight="bold"
      className={clsx({
        "animate-spin motion-reduce:animate-none": status === "pending",
      })}
    />
  );
};
