<script setup lang="ts">
import { useFlare } from "@priemskiyyy/flare-vue";

import { useExternalStore } from "src/composables/useExternalStore";

const flare = useFlare();

// What Flare's diagnostics say about the session, which carries no report content.
const snapshot = useExternalStore(
  flare.value.diagnostics.subscribe,
  flare.value.diagnostics.get,
);
</script>

<template>
  <footer
    aria-label="Session"
    class="flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-200 px-4 py-2 font-mono text-xs text-stone-500 dark:border-stone-800"
  >
    <span class="font-semibold text-stone-600 dark:text-stone-300">
      Flare session
    </span>
    <span>identity #{{ snapshot.generation }}</span>
    <span>breadcrumbs {{ snapshot.breadcrumbs }}</span>
    <span>in flight {{ snapshot.pendingReceipts }}</span>
  </footer>
</template>
