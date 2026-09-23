<script lang="ts">
  import type { LedgerRuntime } from "examples/shared/ledger/types/LedgerRuntime";
  import { ICONS } from "examples/shared/ui/constants/icons";
  import { CARD_CLASS_NAME } from "examples/shared/ui/styles/cardStyles";
  import EmptyState from "src/components/EmptyState/EmptyState.svelte";
  import IconTile from "src/components/IconTile/IconTile.svelte";
  import ReportDetails from "src/components/Report/ReportDetails.svelte";
  import { useExternalStore } from "src/utilities/useExternalStore";

  type Props = { runtime: LedgerRuntime };

  let { runtime }: Props = $props();

  const receipts = useExternalStore(
    (listener) => runtime.receipts.subscribe(listener),
    () => runtime.receipts.getSnapshot(),
  );

  const latest = $derived(receipts.current[0]);
</script>

<section
  aria-label="Latest report"
  class={["flex h-full min-w-0 flex-col gap-4 p-5", CARD_CLASS_NAME]}
>
  <header class="flex flex-col gap-1.5">
    <div class="flex flex-wrap items-center gap-2">
      <IconTile icon={ICONS.broadcast} size="small" />
      <h3
        class="text-base font-semibold tracking-tight text-stone-800 dark:text-stone-200"
      >
        Latest report
      </h3>
    </div>
    <p class="text-sm text-stone-500 dark:text-stone-400">
      Where the last thing you did went: every destination, what it answered,
      and why.
    </p>
  </header>
  {#if latest === undefined}
    <EmptyState
      icon={ICONS.broadcast}
      title="Nothing reported yet"
      description="Press any button in Ledger. Each one fails on purpose, and its report lands here."
    />
  {:else}
    <!-- Keyed by the report, so each new one mounts afresh and flashes. -->
    {#key latest.receipt.id}
      <ReportDetails tracked={latest} />
    {/key}
  {/if}
</section>
