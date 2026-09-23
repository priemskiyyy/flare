import type { Receipt } from "@priemskiyyy/flare";

import type { AccountId } from "src/types/AccountId";
import type { LedgerDestination } from "src/types/LedgerDestination";

export type TrackedReceipt = {
  receipt: Receipt<LedgerDestination>;
  action: string;
  account: AccountId | null;
  at: number;
};
