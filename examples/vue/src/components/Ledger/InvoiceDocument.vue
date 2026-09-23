<script setup lang="ts">
import { ICONS } from "examples/shared/ui/constants/icons";
import BaseIcon from "src/components/BaseIcon/BaseIcon.vue";

const props = defineProps<{ isBroken: boolean }>();

// Read by the template, so a broken preview throws while rendering.
const getPreviewText = () => {
  if (props.isBroken) {
    throw new Error("The invoice template has no field tax.rate");
  }

  return "The preview is rendering normally.";
};
</script>

<template>
  <p
    class="flex items-center gap-2 rounded-lg bg-stone-100/80 px-3 py-2 text-sm text-stone-600 dark:bg-stone-800/60 dark:text-stone-400"
  >
    <BaseIcon :src="ICONS.fileText" size="regular" />
    {{ getPreviewText() }}
  </p>
</template>
