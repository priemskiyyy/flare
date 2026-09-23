<script lang="ts">
  import { OUTCOME_LABELS } from "examples/shared/ledger/constants/labels";
  import type { OutcomeStatus } from "examples/shared/ledger/types/OutcomeStatus";
  import { OUTCOME_ICONS } from "examples/shared/ui/constants/icons";
  import { OUTCOME_TONES } from "examples/shared/ui/constants/tones";
  import Badge from "src/components/Badge/Badge.svelte";
  import BaseIcon from "src/components/BaseIcon/BaseIcon.svelte";

  type Props = { status: OutcomeStatus };

  let { status }: Props = $props();
</script>

<Badge tone={OUTCOME_TONES[status]}>
  <BaseIcon
    src={OUTCOME_ICONS[status]}
    size="xsmall"
    class={{ "animate-spin motion-reduce:animate-none": status === "pending" }}
  />
  {OUTCOME_LABELS[status]}
</Badge>
