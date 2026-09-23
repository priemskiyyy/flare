import type { Receipt } from "@priemskiyyy/flare";
import { Show } from "solid-js";
import type { Component } from "solid-js";

import { ACCOUNTS } from "examples/shared/ledger/constants/accounts";
import type { AccountId } from "examples/shared/ledger/types/AccountId";
import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import { ICONS } from "examples/shared/ui/constants/icons";
import { CARD_CLASS_NAME } from "examples/shared/ui/styles/cardStyles";
import { BaseIcon } from "src/components/BaseIcon/BaseIcon";
import { EmptyState } from "src/components/EmptyState/EmptyState";
import { AccountSwitcher } from "src/components/Ledger/AccountSwitcher";
import { AttachmentUpload } from "src/components/Ledger/AttachmentUpload";
import { InvoiceList } from "src/components/Ledger/InvoiceList";
import { InvoicePreview } from "src/components/Ledger/InvoicePreview";
import { StatusBar } from "src/components/Ledger/StatusBar";

type LedgerAppProps = {
  account: AccountId | null;
  onAccountSelect: (account: AccountId | null) => void;
  onReceipt: (receipt: Receipt<LedgerDestination>, action: string) => void;
};

export const LedgerApp: Component<LedgerAppProps> = (props) => (
  <section
    aria-label="Ledger"
    class={`min-w-0 overflow-hidden ${CARD_CLASS_NAME}`}
  >
    <header class="flex flex-wrap items-center gap-3 border-b border-stone-200 px-4 py-3 dark:border-stone-800">
      <Show
        when={props.account}
        fallback={<span class="text-sm text-stone-500">No company</span>}
      >
        {(account) => (
          <span class="text-sm font-semibold">
            {ACCOUNTS[account()].company}{" "}
            <span class="font-normal text-stone-500">
              · {ACCOUNTS[account()].plan}
            </span>
          </span>
        )}
      </Show>
      <div class="ml-auto">
        <AccountSwitcher
          account={props.account}
          onAccountSelect={props.onAccountSelect}
        />
      </div>
    </header>
    <p class="flex items-center gap-2 border-b border-amber-200/70 bg-amber-50/80 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
      <BaseIcon src={ICONS.lightning} size="regular" />
      Every button here fails on purpose, and each failure becomes one report.
    </p>
    <Show
      when={props.account}
      fallback={
        <div class="p-4">
          <EmptyState
            icon={ICONS.signOut}
            title="Signed out"
            description="Sign in to see your invoices. Attachments and the preview still report, without a user."
          />
        </div>
      }
    >
      {(account) => (
        <InvoiceList account={account()} onReceipt={props.onReceipt} />
      )}
    </Show>
    <div class="grid gap-3 border-t border-stone-200 p-4 lg:grid-cols-2 dark:border-stone-800">
      <AttachmentUpload onReceipt={props.onReceipt} />
      <InvoicePreview onReceipt={props.onReceipt} />
    </div>
    <StatusBar />
  </section>
);
