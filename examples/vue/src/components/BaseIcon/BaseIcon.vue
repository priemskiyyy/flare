<script setup lang="ts">
import { computed } from "vue";

import { iconStyles } from "examples/shared/ui/styles/iconStyles";
import type { IconSize } from "examples/shared/ui/types/IconSize";

const props = defineProps<{ src: string; size: IconSize }>();
const maskImage = computed(() => `url("${props.src}")`);
</script>

<template>
  <span
    aria-hidden="true"
    :class="iconStyles({ size })"
    :style="{ maskImage }"
  />
</template>
