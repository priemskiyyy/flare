import { useFlareStatus } from "@priemskiyyy/flare-react";
import type React from "react";

import { Badge } from "src/components/Badge/Badge";
import { dotStyles } from "src/styles/dotStyles";
import { FLARE_STATUS_LABELS } from "src/utils/constants/labels";
import { FLARE_STATUS_TONES } from "src/utils/constants/tones";

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
