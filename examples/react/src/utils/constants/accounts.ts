import type { Account } from "src/types/Account";
import type { AccountId } from "src/types/AccountId";

export const ACCOUNTS: Record<AccountId, Account> = {
  ada: {
    id: "ada",
    name: "Ada Lovelace",
    initials: "AL",
    email: "ada@acme.test",
    company: "Acme",
    plan: "pro",
  },
  grace: {
    id: "grace",
    name: "Grace Hopper",
    initials: "GH",
    email: "grace@globex.test",
    company: "Globex",
    plan: "free",
  },
};

export const ACCOUNT_IDS: AccountId[] = ["ada", "grace"];

/** Ledger opens signed in, so the invoices are the first thing on the page. */
export const INITIAL_ACCOUNT: AccountId = "ada";
