import type React from "react";

import { OUTCOME_LABELS } from "examples/shared/ledger/constants/labels";
import type { OutcomeStatus } from "examples/shared/ledger/types/OutcomeStatus";
import { OUTCOME_TONES } from "examples/shared/ui/constants/tones";
import { Badge } from "src/components/Badge/Badge";
import { OutcomeIcon } from "src/components/Badge/OutcomeIcon";

type OutcomeBadgeProps = { status: OutcomeStatus };

export const OutcomeBadge: React.FunctionComponent<OutcomeBadgeProps> = ({
  status,
}) => (
  <Badge tone={OUTCOME_TONES[status]}>
    <OutcomeIcon status={status} />
    {OUTCOME_LABELS[status]}
  </Badge>
);
