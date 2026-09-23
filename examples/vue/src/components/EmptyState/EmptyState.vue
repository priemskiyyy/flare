<script setup lang="ts">
import BaseIcon from "src/components/BaseIcon/BaseIcon.vue";

defineProps<{ icon: string; title: string; description: string }>();
</script>

<template>
  <div
    class="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center dark:border-stone-700"
  >
    <span class="text-stone-400">
      <BaseIcon :src="icon" size="large" />
    </span>
    <p class="text-base font-medium">{{ title }}</p>
    <p class="max-w-sm text-sm text-stone-500 dark:text-stone-400">
      {{ description }}
    </p>
  </div>
</template>
