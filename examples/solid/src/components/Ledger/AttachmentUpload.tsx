import type { Receipt } from "@priemskiyyy/flare";
import { useFlare } from "@priemskiyyy/flare-solid";
import { Show, createSignal, onCleanup } from "solid-js";
import type { Component } from "solid-js";

import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import { ICONS } from "examples/shared/ui/constants/icons";
import { buttonStyles } from "examples/shared/ui/styles/buttonStyles";
import { BaseIcon } from "src/components/BaseIcon/BaseIcon";

const UPLOAD_DURATION = 3_000;

type AttachmentUploadProps = {
  onReceipt: (receipt: Receipt<LedgerDestination>, action: string) => void;
};

/** An operation belongs to the account that started it: switch accounts while it runs. */
export const AttachmentUpload: Component<AttachmentUploadProps> = (props) => {
  const flare = useFlare();
  const [isUploading, setIsUploading] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  onCleanup(() => {
    if (timer !== null) {
      clearTimeout(timer);
    }
  });

  const handleUploadPress = () => {
    if (timer !== null) {
      return;
    }

    const upload = flare().scope({
      operation: "attach-receipt",
      tags: { area: "attachments" },
    });

    flare().breadcrumb("attachmentStarted", { file: "receipt.pdf" });
    setIsUploading(true);
    timer = setTimeout(() => {
      timer = null;
      setIsUploading(false);
      props.onReceipt(
        upload.capture(new Error("The upload of receipt.pdf timed out")),
        "Attach receipt.pdf",
      );
    }, UPLOAD_DURATION);
  };

  return (
    <div class="flex flex-col gap-3 rounded-xl border border-stone-200 p-4 dark:border-stone-800">
      <h3 class="text-sm font-semibold">Attachments</h3>
      <p role="status" class="text-sm text-stone-600 dark:text-stone-400">
        <Show
          when={isUploading()}
          fallback="The upload fails after 3 seconds. Switch accounts before it does."
        >
          Uploading receipt.pdf. Switch accounts now.
        </Show>
      </p>
      <button
        type="button"
        disabled={isUploading()}
        onClick={handleUploadPress}
        class={buttonStyles({ size: "small" })}
      >
        <BaseIcon src={ICONS.paperclip} size="small" />
        Attach receipt.pdf
      </button>
    </div>
  );
};
