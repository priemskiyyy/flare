import type { AccountId } from "src/types/AccountId";
import { ACCOUNTS } from "src/utils/constants/accounts";

export const formatAccount = (account: AccountId | null) => {
  if (account === null) {
    return "Signed out";
  }

  return ACCOUNTS[account].name;
};
