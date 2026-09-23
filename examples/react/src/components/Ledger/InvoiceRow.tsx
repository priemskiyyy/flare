import { CreditCard, PaperPlaneTilt } from "@phosphor-icons/react";
import type { Receipt } from "@priemskiyyy/flare";
import { useFlare } from "@priemskiyyy/flare-react";
import type React from "react";

import { formatMoney } from "src/formatting/formatMoney";
import { buttonStyles } from "src/styles/buttonStyles";
import type { Invoice } from "src/types/Invoice";
import type { LedgerDestination } from "src/types/LedgerDestination";
import { PaymentDeclinedError } from "src/utils/PaymentDeclinedError";

type InvoiceRowProps = {
  invoice: Invoice;
  onReceipt: (receipt: Receipt<LedgerDestination>, action: string) => void;
};

export const InvoiceRow: React.FunctionComponent<InvoiceRowProps> = ({
  invoice,
  onReceipt,
}) => {
  const flare = useFlare();

  const handlePayPress = () => {
    flare.breadcrumb("invoiceOpened", { invoice: invoice.id });

    const receipt = flare.capture(
      new PaymentDeclinedError(`The card for ${invoice.id} was declined`),
      {
        tags: { area: "billing" },
        contexts: {
          payment: {
            invoice: invoice.id,
            amount: invoice.amount,
            cardToken: "tok_live_4242",
            iban: "DE89 3704 0044 0532 0130 00",
          },
        },
      },
    );

    onReceipt(receipt, `Pay ${invoice.id}`);
  };

  const handleRemindPress = () => {
    const receipt = flare.message(
      `The reminder to ${invoice.customerEmail} bounced`,
      { level: "warning", tags: { area: "reminders" } },
    );

    onReceipt(receipt, `Remind ${invoice.customer}`);
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">
          {invoice.customer}
        </span>
        <span className="truncate font-mono text-xs text-stone-500">
          {invoice.id} · due {invoice.due}
        </span>
      </span>
      <span className="font-mono text-sm tabular-nums">
        {formatMoney(invoice.amount)}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePayPress}
          className={buttonStyles({ variant: "primary", size: "small" })}
        >
          <CreditCard aria-hidden="true" size={14} weight="bold" />
          Pay {invoice.id}
        </button>
        <button
          type="button"
          onClick={handleRemindPress}
          className={buttonStyles({ size: "small" })}
        >
          <PaperPlaneTilt aria-hidden="true" size={14} weight="bold" />
          Remind {invoice.customer}
        </button>
      </div>
    </li>
  );
};
