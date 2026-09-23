<script setup lang="ts">
import { useFlareStatus } from "@priemskiyyy/flare-vue";
import { computed } from "vue";

import { FLARE_STATUS_LABELS } from "examples/shared/ledger/constants/labels";
import { FLARE_STATUS_TONES } from "examples/shared/ui/constants/tones";
import { dotStyles } from "examples/shared/ui/styles/dotStyles";
import ToneBadge from "src/components/Badge/ToneBadge.vue";

const status = useFlareStatus();
const tone = computed(() => FLARE_STATUS_TONES[status.value.state]);
</script>

<template>
  <ToneBadge :tone="tone">
    <span aria-hidden="true" :class="dotStyles({ tone })" />
    {{ FLARE_STATUS_LABELS[status.state] }}
  </ToneBadge>
</template>
