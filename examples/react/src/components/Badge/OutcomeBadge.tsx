import type React from "react";

import { Badge } from "src/components/Badge/Badge";
import { OutcomeIcon } from "src/components/Badge/OutcomeIcon";
import type { OutcomeStatus } from "src/types/OutcomeStatus";
import { OUTCOME_LABELS } from "src/utils/constants/labels";
import { OUTCOME_TONES } from "src/utils/constants/tones";

type OutcomeBadgeProps = { status: OutcomeStatus };

export const OutcomeBadge: React.FunctionComponent<OutcomeBadgeProps> = ({
  status,
}) => (
  <Badge tone={OUTCOME_TONES[status]}>
    <OutcomeIcon status={status} />
    {OUTCOME_LABELS[status]}
  </Badge>
);
