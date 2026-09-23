import type { RegisteredFlare } from "@priemskiyyy/flare-react";

import { ACCOUNTS } from "examples/shared/ledger/constants/accounts";
import type { AccountId } from "examples/shared/ledger/types/AccountId";

/** What the app does on a sign-in or a sign-out. */
export const switchAccount = (
  flare: RegisteredFlare,
  accountId: AccountId | null,
) => {
  if (accountId === null) {
    flare.user(null);

    return;
  }

  const account = ACCOUNTS[accountId];

  flare.user({ id: account.id, email: account.email, name: account.name });
  flare.tag("plan", account.plan);
  flare.context("company", { name: account.company });
  flare.breadcrumb("signedIn", { company: account.company });
};
