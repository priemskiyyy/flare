import type { Receipt } from "@priemskiyyy/flare";
import { useFlare } from "@priemskiyyy/flare-solid";
import type { Component } from "solid-js";

import { formatMoney } from "examples/shared/ledger/formatting/formatMoney";
import type { Invoice } from "examples/shared/ledger/types/Invoice";
import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import { PaymentDeclinedError } from "examples/shared/ledger/utils/PaymentDeclinedError";
import { ICONS } from "examples/shared/ui/constants/icons";
import { buttonStyles } from "examples/shared/ui/styles/buttonStyles";
import { BaseIcon } from "src/components/BaseIcon/BaseIcon";

type InvoiceRowProps = {
  invoice: Invoice;
  onReceipt: (receipt: Receipt<LedgerDestination>, action: string) => void;
};

export const InvoiceRow: Component<InvoiceRowProps> = (props) => {
  const flare = useFlare();

  const handlePayPress = () => {
    const { invoice } = props;

    flare().breadcrumb("invoiceOpened", { invoice: invoice.id });

    const receipt = flare().capture(
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

    props.onReceipt(receipt, `Pay ${invoice.id}`);
  };

  const handleRemindPress = () => {
    const { invoice } = props;

    const receipt = flare().message(
      `The reminder to ${invoice.customerEmail} bounced`,
      { level: "warning", tags: { area: "reminders" } },
    );

    props.onReceipt(receipt, `Remind ${invoice.customer}`);
  };

  return (
    <li class="flex flex-wrap items-center gap-3 px-4 py-3">
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-sm font-semibold">
          {props.invoice.customer}
        </span>
        <span class="truncate font-mono text-xs text-stone-500">
          {props.invoice.id} · due {props.invoice.due}
        </span>
      </span>
      <span class="font-mono text-sm tabular-nums">
        {formatMoney(props.invoice.amount)}
      </span>
      <div class="flex gap-2">
        <button
          type="button"
          onClick={handlePayPress}
          class={buttonStyles({ variant: "primary", size: "small" })}
        >
          <BaseIcon src={ICONS.creditCard} size="small" />
          Pay {props.invoice.id}
        </button>
        <button
          type="button"
          onClick={handleRemindPress}
          class={buttonStyles({ size: "small" })}
        >
          <BaseIcon src={ICONS.paperPlaneTilt} size="small" />
          Remind {props.invoice.customer}
        </button>
      </div>
    </li>
  );
};
