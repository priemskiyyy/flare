<script lang="ts">
  import type { ReceiptStatus } from "@priemskiyyy/flare";
  import { RECEIPT_LABELS } from "examples/shared/ledger/constants/labels";
  import { RECEIPT_TONES } from "examples/shared/ui/constants/tones";
  import Badge from "src/components/Badge/Badge.svelte";

  type Props = { state: ReceiptStatus["state"] };

  let { state }: Props = $props();
</script>

<Badge tone={RECEIPT_TONES[state]}>{RECEIPT_LABELS[state]}</Badge>
