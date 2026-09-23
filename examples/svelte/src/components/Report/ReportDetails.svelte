<script lang="ts">
  import { DESTINATION_NAMES } from "examples/shared/ledger/constants/destinations";
  import { explainDrop } from "examples/shared/ledger/formatting/explainDrop";
  import { formatAccount } from "examples/shared/ledger/formatting/formatAccount";
  import { formatClockTime } from "examples/shared/ledger/formatting/formatClockTime";
  import { formatShortId } from "examples/shared/ledger/formatting/formatShortId";
  import type { TrackedReceipt } from "examples/shared/ledger/types/TrackedReceipt";
  import { ICONS } from "examples/shared/ui/constants/icons";
  import { CODE_CLASS_NAME } from "examples/shared/ui/styles/codeStyles";
  import ReceiptStateBadge from "src/components/Badge/ReceiptStateBadge.svelte";
  import BaseIcon from "src/components/BaseIcon/BaseIcon.svelte";
  import DestinationOutcomeRow from "src/components/Report/DestinationOutcomeRow.svelte";
  import { useExternalStore } from "src/utilities/useExternalStore";

  type Props = { tracked: TrackedReceipt };

  let { tracked }: Props = $props();

  const status = useExternalStore(
    (listener) => tracked.receipt.status.subscribe(listener),
    () => tracked.receipt.status.get(),
  );
</script>

<div
  class="-m-2 flex animate-flash flex-col gap-4 rounded-xl p-2 motion-reduce:animate-none"
>
  <div class="flex flex-col gap-1">
    <div class="flex flex-wrap items-center gap-2">
      <p class="text-lg font-semibold tracking-tight">{tracked.action}</p>
      <ReceiptStateBadge state={status.current.state} />
    </div>
    <p class="text-sm text-stone-500">
      {formatAccount(tracked.account)} · {formatClockTime(tracked.at)} ·
      <span class="font-mono">{formatShortId(tracked.receipt.id)}</span>
    </p>
  </div>
  {#if status.current.state === "dropped"}
    <div
      role="note"
      class="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-950/40"
    >
      <BaseIcon
        src={ICONS.prohibit}
        size="large"
        class="mt-0.5 text-stone-500"
      />
      <div class="flex flex-col gap-1 text-sm">
        <p class="font-semibold">No destination got this report</p>
        <p class="leading-relaxed text-stone-600 dark:text-stone-400">
          {explainDrop(status.current.reason)}
          <code class={CODE_CLASS_NAME}>{status.current.reason}</code>
        </p>
      </div>
    </div>
  {:else}
    <ul
      aria-label="Destination outcomes"
      class="flex flex-col divide-y divide-stone-200/70 dark:divide-stone-800"
    >
      {#each DESTINATION_NAMES as destination (destination)}
        <DestinationOutcomeRow
          {destination}
          outcome={status.current.outcomes[destination]}
        />
      {/each}
    </ul>
  {/if}
</div>
