import type { Receipt } from "@priemskiyyy/flare";

import type { AccountId } from "examples/shared/ledger/types/AccountId";
import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";

export type TrackedReceipt = {
  receipt: Receipt<LedgerDestination>;
  action: string;
  account: AccountId | null;
  at: number;
};
