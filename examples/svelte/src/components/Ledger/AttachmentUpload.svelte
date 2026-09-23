<script lang="ts">
  import type { Receipt } from "@priemskiyyy/flare";
  import { useFlare } from "@priemskiyyy/flare-svelte";
  import { onDestroy } from "svelte";
  import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
  import { ICONS } from "examples/shared/ui/constants/icons";
  import { buttonStyles } from "examples/shared/ui/styles/buttonStyles";
  import BaseIcon from "src/components/BaseIcon/BaseIcon.svelte";

  const UPLOAD_DURATION = 3_000;

  type Props = {
    onReceipt: (receipt: Receipt<LedgerDestination>, action: string) => void;
  };

  let { onReceipt }: Props = $props();

  const flare = useFlare();
  let isUploading = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  onDestroy(() => {
    if (timer !== null) {
      clearTimeout(timer);
    }
  });

  // An operation belongs to the account that started it: switch accounts while it runs.
  const handleUploadPress = () => {
    if (timer !== null) {
      return;
    }

    const upload = flare.current.scope({
      operation: "attach-receipt",
      tags: { area: "attachments" },
    });

    flare.current.breadcrumb("attachmentStarted", { file: "receipt.pdf" });
    isUploading = true;
    timer = setTimeout(() => {
      timer = null;
      isUploading = false;
      onReceipt(
        upload.capture(new Error("The upload of receipt.pdf timed out")),
        "Attach receipt.pdf",
      );
    }, UPLOAD_DURATION);
  };
</script>

<div
  class="flex flex-col gap-3 rounded-xl border border-stone-200 p-4 dark:border-stone-800"
>
  <h3 class="text-sm font-semibold">Attachments</h3>
  <p role="status" class="text-sm text-stone-600 dark:text-stone-400">
    {#if isUploading}
      Uploading receipt.pdf. Switch accounts now.
    {:else}
      The upload fails after 3 seconds. Switch accounts before it does.
    {/if}
  </p>
  <button
    type="button"
    disabled={isUploading}
    onclick={handleUploadPress}
    class={buttonStyles({ size: "small" })}
  >
    <BaseIcon src={ICONS.paperclip} size="small" />
    Attach receipt.pdf
  </button>
</div>
