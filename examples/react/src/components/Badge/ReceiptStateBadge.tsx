import type { Receipt } from "@priemskiyyy/flare";
import type React from "react";

import { Badge } from "src/components/Badge/Badge";
import { useObservable } from "src/hooks/useObservable";
import type { LedgerDestination } from "src/types/LedgerDestination";
import { RECEIPT_LABELS } from "src/utils/constants/labels";
import { RECEIPT_TONES } from "src/utils/constants/tones";

type ReceiptStateBadgeProps = { receipt: Receipt<LedgerDestination> };

export const ReceiptStateBadge: React.FunctionComponent<
  ReceiptStateBadgeProps
> = ({ receipt }) => {
  const { state } = useObservable(receipt.status);

  return <Badge tone={RECEIPT_TONES[state]}>{RECEIPT_LABELS[state]}</Badge>;
};
