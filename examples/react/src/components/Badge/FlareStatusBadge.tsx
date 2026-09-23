import { useFlareStatus } from "@priemskiyyy/flare-react";
import type React from "react";

import { FLARE_STATUS_LABELS } from "examples/shared/ledger/constants/labels";
import { FLARE_STATUS_TONES } from "examples/shared/ui/constants/tones";
import { dotStyles } from "examples/shared/ui/styles/dotStyles";
import { Badge } from "src/components/Badge/Badge";

export const FlareStatusBadge: React.FunctionComponent = () => {
  const { state } = useFlareStatus();
  const tone = FLARE_STATUS_TONES[state];

  return (
    <Badge tone={tone}>
      <span aria-hidden="true" className={dotStyles({ tone })} />
      {FLARE_STATUS_LABELS[state]}
    </Badge>
  );
};
