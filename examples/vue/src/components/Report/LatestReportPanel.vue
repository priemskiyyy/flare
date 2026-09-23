<script setup lang="ts">
import type { LedgerRuntime } from "examples/shared/ledger/types/LedgerRuntime";
import { ICONS } from "examples/shared/ui/constants/icons";
import { CARD_CLASS_NAME } from "examples/shared/ui/styles/cardStyles";
import EmptyState from "src/components/EmptyState/EmptyState.vue";
import IconTile from "src/components/IconTile/IconTile.vue";
import ReportDetails from "src/components/Report/ReportDetails.vue";
import { useExternalStore } from "src/composables/useExternalStore";

const props = defineProps<{ runtime: LedgerRuntime }>();

const latest = useExternalStore(
  props.runtime.receipts.subscribe,
  () => props.runtime.receipts.getSnapshot()[0],
);
</script>

<template>
  <section
    aria-label="Latest report"
    class="flex h-full min-w-0 flex-col gap-4 p-5"
    :class="CARD_CLASS_NAME"
  >
    <header class="flex flex-col gap-1.5">
      <div class="flex flex-wrap items-center gap-2">
        <IconTile :src="ICONS.broadcast" size="small" />
        <h3
          class="text-base font-semibold tracking-tight text-stone-800 dark:text-stone-200"
        >
          Latest report
        </h3>
      </div>
      <p class="text-sm text-stone-500 dark:text-stone-400">
        Where the last thing you did went: every destination, what it answered,
        and why.
      </p>
    </header>
    <EmptyState
      v-if="latest === undefined"
      :icon="ICONS.broadcast"
      title="Nothing reported yet"
      description="Press any button in Ledger. Each one fails on purpose, and its report lands here."
    />
    <ReportDetails v-else :key="latest.receipt.id" :tracked="latest" />
  </section>
</template>
