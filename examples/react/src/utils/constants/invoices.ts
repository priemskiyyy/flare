import type { AccountId } from "src/types/AccountId";
import type { Invoice } from "src/types/Invoice";

export const INVOICES: Record<AccountId, Invoice[]> = {
  ada: [
    {
      id: "INV-1042",
      customer: "Northwind",
      customerEmail: "billing@northwind.test",
      amount: 1_280,
      due: "Oct 3",
    },
    {
      id: "INV-1043",
      customer: "Initech",
      customerEmail: "ap@initech.test",
      amount: 640,
      due: "Oct 11",
    },
  ],
  grace: [
    {
      id: "INV-2207",
      customer: "Umbrella",
      customerEmail: "finance@umbrella.test",
      amount: 2_150,
      due: "Sep 30",
    },
    {
      id: "INV-2208",
      customer: "Hooli",
      customerEmail: "invoices@hooli.test",
      amount: 395,
      due: "Oct 14",
    },
  ],
};
