import type { Receipt } from "@priemskiyyy/flare";
import { For } from "solid-js";
import type { Component } from "solid-js";

import { INVOICES } from "examples/shared/ledger/constants/invoices";
import type { AccountId } from "examples/shared/ledger/types/AccountId";
import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import { InvoiceRow } from "src/components/Ledger/InvoiceRow";

type InvoiceListProps = {
  account: AccountId;
  onReceipt: (receipt: Receipt<LedgerDestination>, action: string) => void;
};

export const InvoiceList: Component<InvoiceListProps> = (props) => (
  <div class="flex flex-col">
    <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 pt-3">
      <h3 class="text-sm font-semibold">Invoices</h3>
      <p class="text-xs text-stone-500">
        Paying declines the card. A reminder bounces.
      </p>
    </div>
    <ul
      aria-label="Invoices"
      class="flex flex-col divide-y divide-stone-200/70 dark:divide-stone-800"
    >
      <For each={INVOICES[props.account]}>
        {(invoice) => (
          <InvoiceRow invoice={invoice} onReceipt={props.onReceipt} />
        )}
      </For>
    </ul>
  </div>
);
