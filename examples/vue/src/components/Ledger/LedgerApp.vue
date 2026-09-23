<script setup lang="ts">
import type { Receipt } from "@priemskiyyy/flare";

import { ACCOUNTS } from "examples/shared/ledger/constants/accounts";
import type { AccountId } from "examples/shared/ledger/types/AccountId";
import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import { ICONS } from "examples/shared/ui/constants/icons";
import { CARD_CLASS_NAME } from "examples/shared/ui/styles/cardStyles";
import BaseIcon from "src/components/BaseIcon/BaseIcon.vue";
import EmptyState from "src/components/EmptyState/EmptyState.vue";
import AccountSwitcher from "src/components/Ledger/AccountSwitcher.vue";
import AttachmentUpload from "src/components/Ledger/AttachmentUpload.vue";
import InvoiceList from "src/components/Ledger/InvoiceList.vue";
import InvoicePreview from "src/components/Ledger/InvoicePreview.vue";
import StatusBar from "src/components/Ledger/StatusBar.vue";

defineProps<{ account: AccountId | null }>();

const emit = defineEmits<{
  accountSelect: [account: AccountId | null];
  receipt: [receipt: Receipt<LedgerDestination>, action: string];
}>();

const handleReceipt = (receipt: Receipt<LedgerDestination>, action: string) => {
  emit("receipt", receipt, action);
};
</script>

<template>
  <section
    aria-label="Ledger"
    class="min-w-0 overflow-hidden"
    :class="CARD_CLASS_NAME"
  >
    <header
      class="flex flex-wrap items-center gap-3 border-b border-stone-200 px-4 py-3 dark:border-stone-800"
    >
      <span v-if="account === null" class="text-sm text-stone-500">
        No company
      </span>
      <span v-else class="text-sm font-semibold">
        {{ ACCOUNTS[account].company }}
        <span class="font-normal text-stone-500">
          · {{ ACCOUNTS[account].plan }}
        </span>
      </span>
      <div class="ml-auto">
        <AccountSwitcher
          :account="account"
          @select="emit('accountSelect', $event)"
        />
      </div>
    </header>
    <p
      class="flex items-center gap-2 border-b border-amber-200/70 bg-amber-50/80 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
    >
      <BaseIcon :src="ICONS.lightning" size="regular" />
      Every button here fails on purpose, and each failure becomes one report.
    </p>
    <div v-if="account === null" class="p-4">
      <EmptyState
        :icon="ICONS.signOut"
        title="Signed out"
        description="Sign in to see your invoices. Attachments and the preview still report, without a user."
      />
    </div>
    <InvoiceList v-else :account="account" @receipt="handleReceipt" />
    <div
      class="grid gap-3 border-t border-stone-200 p-4 lg:grid-cols-2 dark:border-stone-800"
    >
      <AttachmentUpload @receipt="handleReceipt" />
      <InvoicePreview @receipt="handleReceipt" />
    </div>
    <StatusBar />
  </section>
</template>
