import type { Receipt } from "@priemskiyyy/flare";
import type React from "react";

import { INVOICES } from "examples/shared/ledger/constants/invoices";
import type { AccountId } from "examples/shared/ledger/types/AccountId";
import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import { InvoiceRow } from "src/components/Ledger/InvoiceRow";

type InvoiceListProps = {
  account: AccountId;
  onReceipt: (receipt: Receipt<LedgerDestination>, action: string) => void;
};

export const InvoiceList: React.FunctionComponent<InvoiceListProps> = ({
  account,
  onReceipt,
}) => (
  <div className="flex flex-col">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 pt-3">
      <h3 className="text-sm font-semibold">Invoices</h3>
      <p className="text-xs text-stone-500">
        Paying declines the card. A reminder bounces.
      </p>
    </div>
    <ul
      aria-label="Invoices"
      className="flex flex-col divide-y divide-stone-200/70 dark:divide-stone-800"
    >
      {INVOICES[account].map((invoice) => (
        <InvoiceRow key={invoice.id} invoice={invoice} onReceipt={onReceipt} />
      ))}
    </ul>
  </div>
);
