<script lang="ts">
  import { useFlareStatus } from "@priemskiyyy/flare-svelte";
  import { FLARE_STATUS_LABELS } from "examples/shared/ledger/constants/labels";
  import { FLARE_STATUS_TONES } from "examples/shared/ui/constants/tones";
  import { dotStyles } from "examples/shared/ui/styles/dotStyles";
  import Badge from "src/components/Badge/Badge.svelte";

  const status = useFlareStatus();
  const tone = $derived(FLARE_STATUS_TONES[status.current.state]);
</script>

<Badge {tone}>
  <span aria-hidden="true" class={dotStyles({ tone })}></span>
  {FLARE_STATUS_LABELS[status.current.state]}
</Badge>
