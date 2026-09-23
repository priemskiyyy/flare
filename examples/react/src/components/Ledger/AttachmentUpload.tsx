import { Paperclip } from "@phosphor-icons/react";
import type { Receipt } from "@priemskiyyy/flare";
import { useFlare } from "@priemskiyyy/flare-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

import { buttonStyles } from "src/styles/buttonStyles";
import type { LedgerDestination } from "src/types/LedgerDestination";

const UPLOAD_DURATION = 3_000;

type AttachmentUploadProps = {
  onReceipt: (receipt: Receipt<LedgerDestination>, action: string) => void;
};

/** An operation belongs to the account that started it: switch accounts while it runs. */
export const AttachmentUpload: React.FunctionComponent<
  AttachmentUploadProps
> = ({ onReceipt }) => {
  const flare = useFlare();
  const [isUploading, setIsUploading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const handleUploadPress = () => {
    if (timer.current !== null) {
      return;
    }

    const upload = flare.scope({
      operation: "attach-receipt",
      tags: { area: "attachments" },
    });

    flare.breadcrumb("attachmentStarted", { file: "receipt.pdf" });
    setIsUploading(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setIsUploading(false);
      onReceipt(
        upload.capture(new Error("The upload of receipt.pdf timed out")),
        "Attach receipt.pdf",
      );
    }, UPLOAD_DURATION);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-stone-200 p-4 dark:border-stone-800">
      <h3 className="text-sm font-semibold">Attachments</h3>
      <p role="status" className="text-sm text-stone-600 dark:text-stone-400">
        {isUploading
          ? "Uploading receipt.pdf. Switch accounts now."
          : "The upload fails after 3 seconds. Switch accounts before it does."}
      </p>
      <button
        type="button"
        disabled={isUploading}
        onClick={handleUploadPress}
        className={buttonStyles({ size: "small" })}
      >
        <Paperclip aria-hidden="true" size={14} weight="bold" />
        Attach receipt.pdf
      </button>
    </div>
  );
};
