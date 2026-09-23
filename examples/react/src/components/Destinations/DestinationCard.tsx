import type { DestinationFlushResult } from "@priemskiyyy/flare";
import { useDestinationStatus } from "@priemskiyyy/flare-react";
import clsx from "clsx";
import type React from "react";

import { Badge } from "src/components/Badge/Badge";
import { IconTile } from "src/components/IconTile/IconTile";
import { CARD_CLASS_NAME } from "src/styles/cardStyles";
import type { LedgerDestination } from "src/types/LedgerDestination";
import {
  BILLING_DESTINATIONS,
  DESTINATION_GUIDES,
} from "src/utils/constants/destinations";
import { DESTINATION_ICONS } from "src/utils/constants/icons";
import { DESTINATION_STATUS_LABELS } from "src/utils/constants/labels";
import { DESTINATION_STATUS_TONES } from "src/utils/constants/tones";

type DestinationCardProps = {
  name: LedgerDestination;
  lastReceived: string | null;
  flush: DestinationFlushResult | null;
};

const describeRoute = (name: LedgerDestination) => {
  if (BILLING_DESTINATIONS.includes(name)) {
    return "Billing and product reports";
  }

  return "Product reports only";
};

export const DestinationCard: React.FunctionComponent<DestinationCardProps> = ({
  name,
  lastReceived,
  flush,
}) => {
  const status = useDestinationStatus(name);
  const guide = DESTINATION_GUIDES[name];

  return (
    <li className={clsx("flex min-w-0 flex-col gap-3 p-4", CARD_CLASS_NAME)}>
      <div className="flex items-start gap-3">
        <IconTile icon={DESTINATION_ICONS[name]} size="regular" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">{guide.name}</h4>
            <Badge tone={DESTINATION_STATUS_TONES[status.state]}>
              {DESTINATION_STATUS_LABELS[status.state]}
            </Badge>
            {flush === null ? null : (
              <Badge tone="neutral">flush · {flush.status}</Badge>
            )}
          </div>
          <p className="truncate font-mono text-xs text-stone-500">
            {guide.provider}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <dt className="text-stone-500">Routes</dt>
        <dd>{describeRoute(name)}</dd>
        <dt className="text-stone-500">Evidence</dt>
        <dd>{guide.evidence}</dd>
        <dt className="text-stone-500">Messages</dt>
        <dd>{guide.messages}</dd>
        <dt className="text-stone-500">Flush</dt>
        <dd>{guide.flush}</dd>
        <dt className="text-stone-500">Last received</dt>
        <dd className="truncate">{lastReceived ?? "Nothing yet"}</dd>
      </dl>
    </li>
  );
};
