import { FileText } from "@phosphor-icons/react";
import type React from "react";

type InvoiceDocumentProps = { isBroken: boolean };

/** Throws while rendering, the one kind of error a boundary can see. */
export const InvoiceDocument: React.FunctionComponent<InvoiceDocumentProps> = ({
  isBroken,
}) => {
  if (isBroken) {
    throw new Error("The invoice template has no field tax.rate");
  }

  return (
    <p className="flex items-center gap-2 rounded-lg bg-stone-100/80 px-3 py-2 text-sm text-stone-600 dark:bg-stone-800/60 dark:text-stone-400">
      <FileText aria-hidden="true" size={16} weight="duotone" />
      The preview is rendering normally.
    </p>
  );
};
