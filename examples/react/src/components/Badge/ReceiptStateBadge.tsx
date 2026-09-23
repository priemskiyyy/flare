import type { Receipt } from "@priemskiyyy/flare";
import type React from "react";

import { RECEIPT_LABELS } from "examples/shared/ledger/constants/labels";
import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import { RECEIPT_TONES } from "examples/shared/ui/constants/tones";
import { Badge } from "src/components/Badge/Badge";
import { useObservable } from "src/hooks/useObservable";

type ReceiptStateBadgeProps = { receipt: Receipt<LedgerDestination> };

export const ReceiptStateBadge: React.FunctionComponent<
  ReceiptStateBadgeProps
> = ({ receipt }) => {
  const { state } = useObservable(receipt.status);

  return <Badge tone={RECEIPT_TONES[state]}>{RECEIPT_LABELS[state]}</Badge>;
};
