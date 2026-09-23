import { ACCOUNTS } from "examples/shared/ledger/constants/accounts";
import type { AccountId } from "examples/shared/ledger/types/AccountId";

export const formatAccount = (account: AccountId | null) => {
  if (account === null) {
    return "Signed out";
  }

  return ACCOUNTS[account].name;
};
