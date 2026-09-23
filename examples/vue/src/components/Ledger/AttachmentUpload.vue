<script setup lang="ts">
import type { Receipt } from "@priemskiyyy/flare";
import { useFlare } from "@priemskiyyy/flare-vue";
import { onUnmounted, ref } from "vue";

import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import { ICONS } from "examples/shared/ui/constants/icons";
import { buttonStyles } from "examples/shared/ui/styles/buttonStyles";
import BaseIcon from "src/components/BaseIcon/BaseIcon.vue";

const UPLOAD_DURATION = 3_000;

const emit = defineEmits<{
  receipt: [receipt: Receipt<LedgerDestination>, action: string];
}>();

const flare = useFlare();
const isUploading = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

onUnmounted(() => {
  if (timer !== null) {
    clearTimeout(timer);
  }
});

// An operation belongs to the account that started it: switch accounts while it runs.
const handleUploadClick = () => {
  if (timer !== null) {
    return;
  }

  const upload = flare.value.scope({
    operation: "attach-receipt",
    tags: { area: "attachments" },
  });

  flare.value.breadcrumb("attachmentStarted", { file: "receipt.pdf" });
  isUploading.value = true;
  timer = setTimeout(() => {
    timer = null;
    isUploading.value = false;
    emit(
      "receipt",
      upload.capture(new Error("The upload of receipt.pdf timed out")),
      "Attach receipt.pdf",
    );
  }, UPLOAD_DURATION);
};
</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-xl border border-stone-200 p-4 dark:border-stone-800"
  >
    <h3 class="text-sm font-semibold">Attachments</h3>
    <p role="status" class="text-sm text-stone-600 dark:text-stone-400">
      {{
        isUploading
          ? "Uploading receipt.pdf. Switch accounts now."
          : "The upload fails after 3 seconds. Switch accounts before it does."
      }}
    </p>
    <button
      type="button"
      :disabled="isUploading"
      :class="buttonStyles({ size: 'small' })"
      @click="handleUploadClick"
    >
      <BaseIcon :src="ICONS.paperclip" size="small" />
      Attach receipt.pdf
    </button>
  </div>
</template>
