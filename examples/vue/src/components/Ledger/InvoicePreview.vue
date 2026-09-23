<script setup lang="ts">
import type { Receipt } from "@priemskiyyy/flare";
import { FlareErrorBoundary } from "@priemskiyyy/flare-vue";
import { ref } from "vue";

import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import { ICONS } from "examples/shared/ui/constants/icons";
import { buttonStyles } from "examples/shared/ui/styles/buttonStyles";
import BaseIcon from "src/components/BaseIcon/BaseIcon.vue";
import InvoiceDocument from "src/components/Ledger/InvoiceDocument.vue";

const emit = defineEmits<{
  receipt: [receipt: Receipt<LedgerDestination>, action: string];
}>();

const isBroken = ref(false);

const handleError = ({ receipt }: { receipt: Receipt<LedgerDestination> }) => {
  emit("receipt", receipt, "Render the preview");
};

const handleResetClick = (reset: () => void) => {
  isBroken.value = false;
  reset();
};
</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-xl border border-stone-200 p-4 dark:border-stone-800"
  >
    <h3 class="text-sm font-semibold">Preview</h3>
    <p class="text-sm text-stone-600 dark:text-stone-400">
      Breaking it throws while rendering, and the error boundary reports it.
    </p>
    <FlareErrorBoundary
      :capture="{ tags: { area: 'preview' } }"
      :on-error="handleError"
    >
      <InvoiceDocument :is-broken="isBroken" />
      <template #fallback="{ reset }">
        <div
          role="alert"
          class="flex flex-wrap items-center gap-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
        >
          <span class="flex-1">The preview crashed and was reported.</span>
          <button
            type="button"
            :class="buttonStyles({ size: 'small' })"
            @click="handleResetClick(reset)"
          >
            Reset the preview
          </button>
        </div>
      </template>
    </FlareErrorBoundary>
    <button
      type="button"
      :disabled="isBroken"
      :class="buttonStyles({ size: 'small' })"
      @click="isBroken = true"
    >
      <BaseIcon :src="ICONS.eye" size="small" />
      Break the preview
    </button>
  </div>
</template>
