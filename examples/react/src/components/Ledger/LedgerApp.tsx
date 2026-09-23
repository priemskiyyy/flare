import { Lightning, SignOut } from "@phosphor-icons/react";
import type { Receipt } from "@priemskiyyy/flare";
import clsx from "clsx";
import type React from "react";

import { EmptyState } from "src/components/EmptyState/EmptyState";
import { AccountSwitcher } from "src/components/Ledger/AccountSwitcher";
import { AttachmentUpload } from "src/components/Ledger/AttachmentUpload";
import { InvoiceList } from "src/components/Ledger/InvoiceList";
import { InvoicePreview } from "src/components/Ledger/InvoicePreview";
import { StatusBar } from "src/components/Ledger/StatusBar";
import { CARD_CLASS_NAME } from "src/styles/cardStyles";
import type { AccountId } from "src/types/AccountId";
import type { LedgerDestination } from "src/types/LedgerDestination";
import { ACCOUNTS } from "src/utils/constants/accounts";

type LedgerAppProps = {
  account: AccountId | null;
  onAccountSelect: (account: AccountId | null) => void;
  onReceipt: (receipt: Receipt<LedgerDestination>, action: string) => void;
};

const CompanyName: React.FunctionComponent<{ account: AccountId | null }> = ({
  account,
}) => {
  if (account === null) {
    return <span className="text-sm text-stone-500">No company</span>;
  }

  const { company, plan } = ACCOUNTS[account];

  return (
    <span className="text-sm font-semibold">
      {company} <span className="font-normal text-stone-500">· {plan}</span>
    </span>
  );
};

export const LedgerApp: React.FunctionComponent<LedgerAppProps> = ({
  account,
  onAccountSelect,
  onReceipt,
}) => (
  <section
    aria-label="Ledger"
    className={clsx("min-w-0 overflow-hidden", CARD_CLASS_NAME)}
  >
    <header className="flex flex-wrap items-center gap-3 border-b border-stone-200 px-4 py-3 dark:border-stone-800">
      <CompanyName account={account} />
      <div className="ml-auto">
        <AccountSwitcher account={account} onAccountSelect={onAccountSelect} />
      </div>
    </header>
    <p className="flex items-center gap-2 border-b border-amber-200/70 bg-amber-50/80 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
      <Lightning
        aria-hidden="true"
        size={16}
        weight="duotone"
        className="shrink-0"
      />
      Every button here fails on purpose, and each failure becomes one report.
    </p>
    {account === null ? (
      <div className="p-4">
        <EmptyState
          icon={SignOut}
          title="Signed out"
          description="Sign in to see your invoices. Attachments and the preview still report, without a user."
        />
      </div>
    ) : (
      <InvoiceList account={account} onReceipt={onReceipt} />
    )}
    <div className="grid gap-3 border-t border-stone-200 p-4 lg:grid-cols-2 dark:border-stone-800">
      <AttachmentUpload onReceipt={onReceipt} />
      <InvoicePreview onReceipt={onReceipt} />
    </div>
    <StatusBar />
  </section>
);
