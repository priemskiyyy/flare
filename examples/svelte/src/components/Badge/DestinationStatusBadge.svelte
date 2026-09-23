<script lang="ts">
  import { useDestinationStatus } from "@priemskiyyy/flare-svelte";
  import { DESTINATION_STATUS_LABELS } from "examples/shared/ledger/constants/labels";
  import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
  import { DESTINATION_STATUS_TONES } from "examples/shared/ui/constants/tones";
  import { dotStyles } from "examples/shared/ui/styles/dotStyles";

  type Props = { destination: LedgerDestination };

  let { destination }: Props = $props();

  const status = useDestinationStatus(() => destination);
</script>

<span class="inline-flex items-center gap-1.5 text-xs text-stone-500">
  <span
    aria-hidden="true"
    class={dotStyles({ tone: DESTINATION_STATUS_TONES[status.current.state] })}
  ></span>
  {DESTINATION_STATUS_LABELS[status.current.state]}
</span>
