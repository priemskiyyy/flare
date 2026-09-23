<script lang="ts">
  import type { DestinationOutcome } from "@priemskiyyy/flare";
  import { DESTINATION_GUIDES } from "examples/shared/ledger/constants/destinations";
  import { explainOutcome } from "examples/shared/ledger/formatting/explainOutcome";
  import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
  import { getOutcomeCode } from "examples/shared/ledger/utils/getOutcomeCode";
  import { getOutcomeStatus } from "examples/shared/ledger/utils/getOutcomeStatus";
  import { DESTINATION_ICONS } from "examples/shared/ui/constants/icons";
  import { CODE_CLASS_NAME } from "examples/shared/ui/styles/codeStyles";
  import DestinationStatusBadge from "src/components/Badge/DestinationStatusBadge.svelte";
  import OutcomeBadge from "src/components/Badge/OutcomeBadge.svelte";
  import BaseIcon from "src/components/BaseIcon/BaseIcon.svelte";

  type Props = {
    destination: LedgerDestination;
    /** `undefined` when routing left this destination out, `null` until it answers. */
    outcome: DestinationOutcome | null | undefined;
  };

  let { destination, outcome }: Props = $props();

  const code = $derived(getOutcomeCode(outcome));
</script>

<li
  aria-label={DESTINATION_GUIDES[destination].name}
  class={[
    "flex items-start gap-3 py-3",
    { "opacity-60": outcome === undefined },
  ]}
>
  <span
    aria-hidden="true"
    class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
  >
    <BaseIcon src={DESTINATION_ICONS[destination]} size="regular" />
  </span>
  <div class="flex min-w-0 flex-1 flex-col gap-1">
    <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span class="flex flex-wrap items-center gap-x-2">
        <span class="font-medium">{DESTINATION_GUIDES[destination].name}</span>
        <DestinationStatusBadge {destination} />
      </span>
      <OutcomeBadge status={getOutcomeStatus(outcome)} />
    </div>
    <p class="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
      {explainOutcome(destination, outcome)}
      {#if code !== null}
        <code class={CODE_CLASS_NAME}>{code}</code>
      {/if}
    </p>
  </div>
</li>
