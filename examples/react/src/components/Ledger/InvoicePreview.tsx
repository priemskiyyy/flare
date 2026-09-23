import { Eye } from "@phosphor-icons/react";
import type { Receipt } from "@priemskiyyy/flare";
import { FlareErrorBoundary } from "@priemskiyyy/flare-react";
import type React from "react";
import { useState } from "react";

import { InvoiceDocument } from "src/components/Ledger/InvoiceDocument";
import { buttonStyles } from "src/styles/buttonStyles";
import type { LedgerDestination } from "src/types/LedgerDestination";

type InvoicePreviewProps = {
  onReceipt: (receipt: Receipt<LedgerDestination>, action: string) => void;
};

export const InvoicePreview: React.FunctionComponent<InvoicePreviewProps> = ({
  onReceipt,
}) => {
  const [isBroken, setIsBroken] = useState(false);

  const handleResetPress = (reset: () => void) => {
    setIsBroken(false);
    reset();
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-stone-200 p-4 dark:border-stone-800">
      <h3 className="text-sm font-semibold">Preview</h3>
      <p className="text-sm text-stone-600 dark:text-stone-400">
        Breaking it throws while rendering, and the error boundary reports it.
      </p>
      <FlareErrorBoundary
        capture={{ tags: { area: "preview" } }}
        onError={({ receipt }) => onReceipt(receipt, "Render the preview")}
        fallback={({ reset }) => (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
          >
            <span className="flex-1">
              The preview crashed and was reported.
            </span>
            <button
              type="button"
              onClick={() => handleResetPress(reset)}
              className={buttonStyles({ size: "small" })}
            >
              Reset the preview
            </button>
          </div>
        )}
      >
        <InvoiceDocument isBroken={isBroken} />
      </FlareErrorBoundary>
      <button
        type="button"
        disabled={isBroken}
        onClick={() => setIsBroken(true)}
        className={buttonStyles({ size: "small" })}
      >
        <Eye aria-hidden="true" size={14} weight="bold" />
        Break the preview
      </button>
    </div>
  );
};
