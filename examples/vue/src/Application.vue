<script setup lang="ts">
import type { Receipt } from "@priemskiyyy/flare";
import { FlareDevtools } from "@priemskiyyy/flare-devtools/vue";
import { FlareProvider } from "@priemskiyyy/flare-vue";
import { onMounted, onUnmounted, ref } from "vue";

import { INITIAL_ACCOUNT } from "examples/shared/ledger/constants/accounts";
import type { AccountId } from "examples/shared/ledger/types/AccountId";
import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import type { LedgerRuntime } from "examples/shared/ledger/types/LedgerRuntime";
import type { SimulatedProviders } from "examples/shared/ledger/types/SimulatedProviders";
import { switchAccount } from "examples/shared/ledger/utils/switchAccount";
import LedgerApp from "src/components/Ledger/LedgerApp.vue";
import PageHeader from "src/components/PageHeader/PageHeader.vue";
import LatestReportPanel from "src/components/Report/LatestReportPanel.vue";

const props = defineProps<{
  providers: SimulatedProviders;
  runtime: LedgerRuntime;
}>();

const account = ref<AccountId | null>(INITIAL_ACCOUNT);

// A page that is being hidden may never come back: send what is queued.
const handleVisibilityChange = () => {
  if (document.visibilityState !== "hidden") {
    return;
  }

  props.runtime.flare.flush({ timeout: 1_000 }).catch(() => {});
};

onMounted(() => {
  document.addEventListener("visibilitychange", handleVisibilityChange);
});

onUnmounted(() => {
  document.removeEventListener("visibilitychange", handleVisibilityChange);
});

const handleAccountSelect = (next: AccountId | null) => {
  account.value = next;
  switchAccount(props.runtime.flare, props.providers, next);
};

const handleReceipt = (receipt: Receipt<LedgerDestination>, action: string) => {
  props.runtime.track(receipt, action, account.value);
};
</script>

<template>
  <FlareProvider :flare="runtime.flare">
    <PageHeader />
    <main class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div class="flex max-w-3xl flex-col gap-2">
        <h2 class="text-2xl font-semibold tracking-tight sm:text-3xl">
          Ledger on Vue
        </h2>
        <p class="text-base text-stone-600 dark:text-stone-400">
          The invoicing app from the React example, written with Vue
          composables. Every button fails on purpose, and the latest report
          shows where it went and what each destination answered. The Flare
          button in the corner opens the devtools over the same runtime.
        </p>
      </div>
      <div class="grid items-start gap-4 lg:grid-cols-2">
        <LedgerApp
          :account="account"
          @account-select="handleAccountSelect"
          @receipt="handleReceipt"
        />
        <LatestReportPanel :runtime="runtime" />
      </div>
    </main>
    <FlareDevtools />
  </FlareProvider>
</template>
