<script lang="ts">
  import type { Receipt } from "@priemskiyyy/flare";
  import { useFlare } from "@priemskiyyy/flare-svelte";
  import { formatMoney } from "examples/shared/ledger/formatting/formatMoney";
  import type { Invoice } from "examples/shared/ledger/types/Invoice";
  import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
  import { PaymentDeclinedError } from "examples/shared/ledger/utils/PaymentDeclinedError";
  import { ICONS } from "examples/shared/ui/constants/icons";
  import { buttonStyles } from "examples/shared/ui/styles/buttonStyles";
  import BaseIcon from "src/components/BaseIcon/BaseIcon.svelte";

  type Props = {
    invoice: Invoice;
    onReceipt: (receipt: Receipt<LedgerDestination>, action: string) => void;
  };

  let { invoice, onReceipt }: Props = $props();

  const flare = useFlare();

  const handlePayPress = () => {
    flare.current.breadcrumb("invoiceOpened", { invoice: invoice.id });

    const receipt = flare.current.capture(
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
    const receipt = flare.current.message(
      `The reminder to ${invoice.customerEmail} bounced`,
      { level: "warning", tags: { area: "reminders" } },
    );

    onReceipt(receipt, `Remind ${invoice.customer}`);
  };
</script>

<li class="flex flex-wrap items-center gap-3 px-4 py-3">
  <span class="flex min-w-0 flex-1 flex-col">
    <span class="truncate text-sm font-semibold">{invoice.customer}</span>
    <span class="truncate font-mono text-xs text-stone-500">
      {invoice.id} · due {invoice.due}
    </span>
  </span>
  <span class="font-mono text-sm tabular-nums">
    {formatMoney(invoice.amount)}
  </span>
  <div class="flex gap-2">
    <button
      type="button"
      onclick={handlePayPress}
      class={buttonStyles({ variant: "primary", size: "small" })}
    >
      <BaseIcon src={ICONS.creditCard} size="small" />
      Pay {invoice.id}
    </button>
    <button
      type="button"
      onclick={handleRemindPress}
      class={buttonStyles({ size: "small" })}
    >
      <BaseIcon src={ICONS.paperPlaneTilt} size="small" />
      Remind {invoice.customer}
    </button>
  </div>
</li>
