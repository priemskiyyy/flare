<script setup lang="ts">
import { OUTCOME_LABELS } from "examples/shared/ledger/constants/labels";
import type { OutcomeStatus } from "examples/shared/ledger/types/OutcomeStatus";
import { OUTCOME_ICONS } from "examples/shared/ui/constants/icons";
import { OUTCOME_TONES } from "examples/shared/ui/constants/tones";
import ToneBadge from "src/components/Badge/ToneBadge.vue";
import BaseIcon from "src/components/BaseIcon/BaseIcon.vue";

defineProps<{ status: OutcomeStatus }>();
</script>

<template>
  <ToneBadge :tone="OUTCOME_TONES[status]">
    <BaseIcon
      :src="OUTCOME_ICONS[status]"
      size="xsmall"
      :class="{
        'animate-spin motion-reduce:animate-none': status === 'pending',
      }"
    />
    {{ OUTCOME_LABELS[status] }}
  </ToneBadge>
</template>
