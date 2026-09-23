<script setup lang="ts">
import { DESTINATION_NAMES } from "examples/shared/ledger/constants/destinations";
import { RECEIPT_LABELS } from "examples/shared/ledger/constants/labels";
import { explainDrop } from "examples/shared/ledger/formatting/explainDrop";
import { formatAccount } from "examples/shared/ledger/formatting/formatAccount";
import { formatClockTime } from "examples/shared/ledger/formatting/formatClockTime";
import { formatShortId } from "examples/shared/ledger/formatting/formatShortId";
import type { TrackedReceipt } from "examples/shared/ledger/types/TrackedReceipt";
import { ICONS } from "examples/shared/ui/constants/icons";
import { RECEIPT_TONES } from "examples/shared/ui/constants/tones";
import { CODE_CLASS_NAME } from "examples/shared/ui/styles/codeStyles";
import ToneBadge from "src/components/Badge/ToneBadge.vue";
import BaseIcon from "src/components/BaseIcon/BaseIcon.vue";
import DestinationOutcomeRow from "src/components/Report/DestinationOutcomeRow.vue";
import { useExternalStore } from "src/composables/useExternalStore";

// The parent keys this by the receipt, so one report is followed for its whole life.
const props = defineProps<{ tracked: TrackedReceipt }>();
const { receipt } = props.tracked;
const status = useExternalStore(receipt.status.subscribe, receipt.status.get);
</script>

<template>
  <div
    class="-m-2 flex animate-flash flex-col gap-4 rounded-xl p-2 motion-reduce:animate-none"
  >
    <div class="flex flex-col gap-1">
      <div class="flex flex-wrap items-center gap-2">
        <p class="text-lg font-semibold tracking-tight">{{ tracked.action }}</p>
        <ToneBadge :tone="RECEIPT_TONES[status.state]">
          {{ RECEIPT_LABELS[status.state] }}
        </ToneBadge>
      </div>
      <p class="text-sm text-stone-500">
        {{ formatAccount(tracked.account) }} · {{ formatClockTime(tracked.at) }}
        ·
        <span class="font-mono">{{ formatShortId(receipt.id) }}</span>
      </p>
    </div>
    <div
      v-if="status.state === 'dropped'"
      role="note"
      class="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-950/40"
    >
      <span class="mt-0.5 text-stone-500">
        <BaseIcon :src="ICONS.prohibit" size="large" />
      </span>
      <div class="flex flex-col gap-1 text-sm">
        <p class="font-semibold">No destination got this report</p>
        <p class="leading-relaxed text-stone-600 dark:text-stone-400">
          {{ explainDrop(status.reason) }}
          <code :class="CODE_CLASS_NAME">{{ status.reason }}</code>
        </p>
      </div>
    </div>
    <ul
      v-else
      aria-label="Destination outcomes"
      class="flex flex-col divide-y divide-stone-200/70 dark:divide-stone-800"
    >
      <DestinationOutcomeRow
        v-for="destination in DESTINATION_NAMES"
        :key="destination"
        :destination="destination"
        :outcome="status.outcomes[destination]"
      />
    </ul>
  </div>
</template>
