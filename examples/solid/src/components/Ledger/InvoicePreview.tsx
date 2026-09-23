import type { Receipt } from "@priemskiyyy/flare";
import { FlareErrorBoundary } from "@priemskiyyy/flare-solid";
import { createSignal } from "solid-js";
import type { Component } from "solid-js";

import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import { ICONS } from "examples/shared/ui/constants/icons";
import { buttonStyles } from "examples/shared/ui/styles/buttonStyles";
import { BaseIcon } from "src/components/BaseIcon/BaseIcon";
import { InvoiceDocument } from "src/components/Ledger/InvoiceDocument";

type InvoicePreviewProps = {
  onReceipt: (receipt: Receipt<LedgerDestination>, action: string) => void;
};

export const InvoicePreview: Component<InvoicePreviewProps> = (props) => {
  const [isBroken, setIsBroken] = createSignal(false);

  const handleResetPress = (reset: () => void) => {
    setIsBroken(false);
    reset();
  };

  return (
    <div class="flex flex-col gap-3 rounded-xl border border-stone-200 p-4 dark:border-stone-800">
      <h3 class="text-sm font-semibold">Preview</h3>
      <p class="text-sm text-stone-600 dark:text-stone-400">
        Breaking it throws while rendering, and the error boundary reports it.
      </p>
      <FlareErrorBoundary
        capture={{ tags: { area: "preview" } }}
        onError={({ receipt }) =>
          props.onReceipt(receipt, "Render the preview")
        }
        fallback={({ reset }) => (
          <div
            role="alert"
            class="flex flex-wrap items-center gap-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
          >
            <span class="flex-1">The preview crashed and was reported.</span>
            <button
              type="button"
              onClick={() => handleResetPress(reset)}
              class={buttonStyles({ size: "small" })}
            >
              Reset the preview
            </button>
          </div>
        )}
      >
        <InvoiceDocument isBroken={isBroken()} />
      </FlareErrorBoundary>
      <button
        type="button"
        disabled={isBroken()}
        onClick={() => setIsBroken(true)}
        class={buttonStyles({ size: "small" })}
      >
        <BaseIcon src={ICONS.eye} size="small" />
        Break the preview
      </button>
    </div>
  );
};
