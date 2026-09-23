import { createMemo } from "solid-js";
import type { Component } from "solid-js";

import { ICONS } from "examples/shared/ui/constants/icons";
import { BaseIcon } from "src/components/BaseIcon/BaseIcon";

type InvoiceDocumentProps = { isBroken: boolean };

/** Throws while rendering once it is broken, the kind of error a boundary can see. */
export const InvoiceDocument: Component<InvoiceDocumentProps> = (props) => {
  const text = createMemo(() => {
    if (props.isBroken) {
      throw new Error("The invoice template has no field tax.rate");
    }

    return "The preview is rendering normally.";
  });

  return (
    <p class="flex items-center gap-2 rounded-lg bg-stone-100/80 px-3 py-2 text-sm text-stone-600 dark:bg-stone-800/60 dark:text-stone-400">
      <BaseIcon src={ICONS.fileText} size="regular" />
      {text()}
    </p>
  );
};
