<script lang="ts">
  import type { Receipt } from "@priemskiyyy/flare";
  import { ACCOUNTS } from "examples/shared/ledger/constants/accounts";
  import type { AccountId } from "examples/shared/ledger/types/AccountId";
  import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
  import { ICONS } from "examples/shared/ui/constants/icons";
  import { CARD_CLASS_NAME } from "examples/shared/ui/styles/cardStyles";
  import BaseIcon from "src/components/BaseIcon/BaseIcon.svelte";
  import EmptyState from "src/components/EmptyState/EmptyState.svelte";
  import AccountSwitcher from "src/components/Ledger/AccountSwitcher.svelte";
  import AttachmentUpload from "src/components/Ledger/AttachmentUpload.svelte";
  import InvoiceList from "src/components/Ledger/InvoiceList.svelte";
  import InvoicePreview from "src/components/Ledger/InvoicePreview.svelte";
  import StatusBar from "src/components/Ledger/StatusBar.svelte";

  type Props = {
    account: AccountId | null;
    onAccountSelect: (account: AccountId | null) => void;
    onReceipt: (receipt: Receipt<LedgerDestination>, action: string) => void;
  };

  let { account, onAccountSelect, onReceipt }: Props = $props();
</script>

<section
  aria-label="Ledger"
  class={["min-w-0 overflow-hidden", CARD_CLASS_NAME]}
>
  <header
    class="flex flex-wrap items-center gap-3 border-b border-stone-200 px-4 py-3 dark:border-stone-800"
  >
    {#if account === null}
      <span class="text-sm text-stone-500">No company</span>
    {:else}
      <span class="text-sm font-semibold">
        {ACCOUNTS[account].company}
        <span class="font-normal text-stone-500">
          · {ACCOUNTS[account].plan}
        </span>
      </span>
    {/if}
    <div class="ml-auto">
      <AccountSwitcher {account} {onAccountSelect} />
    </div>
  </header>
  <p
    class="flex items-center gap-2 border-b border-amber-200/70 bg-amber-50/80 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
  >
    <BaseIcon src={ICONS.lightning} size="regular" />
    Every button here fails on purpose, and each failure becomes one report.
  </p>
  {#if account === null}
    <div class="p-4">
      <EmptyState
        icon={ICONS.signOut}
        title="Signed out"
        description="Sign in to see your invoices. Attachments and the preview still report, without a user."
      />
    </div>
  {:else}
    <InvoiceList {account} {onReceipt} />
  {/if}
  <div
    class="grid gap-3 border-t border-stone-200 p-4 lg:grid-cols-2 dark:border-stone-800"
  >
    <AttachmentUpload {onReceipt} />
    <InvoicePreview {onReceipt} />
  </div>
  <StatusBar />
</section>
