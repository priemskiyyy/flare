<script setup lang="ts">
import type { DestinationOutcome } from "@priemskiyyy/flare";
import { useDestinationStatus } from "@priemskiyyy/flare-vue";
import { computed } from "vue";

import { DESTINATION_GUIDES } from "examples/shared/ledger/constants/destinations";
import { DESTINATION_STATUS_LABELS } from "examples/shared/ledger/constants/labels";
import { explainOutcome } from "examples/shared/ledger/formatting/explainOutcome";
import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import { getOutcomeCode } from "examples/shared/ledger/utils/getOutcomeCode";
import { getOutcomeStatus } from "examples/shared/ledger/utils/getOutcomeStatus";
import { DESTINATION_ICONS } from "examples/shared/ui/constants/icons";
import { CODE_CLASS_NAME } from "examples/shared/ui/styles/codeStyles";
import OutcomeBadge from "src/components/Badge/OutcomeBadge.vue";
import BaseIcon from "src/components/BaseIcon/BaseIcon.vue";

const props = defineProps<{
  destination: LedgerDestination;
  /** `undefined` when routing left this destination out, `null` until it answers. */
  outcome: DestinationOutcome | null | undefined;
}>();

const status = useDestinationStatus(() => props.destination);
const code = computed(() => getOutcomeCode(props.outcome));
</script>

<template>
  <li
    :aria-label="DESTINATION_GUIDES[destination].name"
    class="flex items-start gap-3 py-3"
    :class="{ 'opacity-60': outcome === undefined }"
  >
    <span
      aria-hidden="true"
      class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
    >
      <BaseIcon :src="DESTINATION_ICONS[destination]" size="regular" />
    </span>
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span class="flex flex-wrap items-baseline gap-x-2">
          <span class="font-medium">
            {{ DESTINATION_GUIDES[destination].name }}
          </span>
          <span class="text-xs text-stone-500">
            {{ DESTINATION_STATUS_LABELS[status.state] }}
          </span>
        </span>
        <OutcomeBadge :status="getOutcomeStatus(outcome)" />
      </div>
      <p class="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
        {{ explainOutcome(destination, outcome) }}
        <code v-if="code !== null" :class="CODE_CLASS_NAME">{{ code }}</code>
      </p>
    </div>
  </li>
</template>
