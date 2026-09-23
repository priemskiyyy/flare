import type { AccountId } from "src/types/AccountId";

export type Account = {
  id: AccountId;
  name: string;
  initials: string;
  email: string;
  company: string;
  plan: "free" | "pro";
};
