<script lang="ts">
  import { ICONS } from "examples/shared/ui/constants/icons";
  import { buttonStyles } from "examples/shared/ui/styles/buttonStyles";
  import FlareStatusBadge from "src/components/Badge/FlareStatusBadge.svelte";
  import BaseIcon from "src/components/BaseIcon/BaseIcon.svelte";
  import IconTile from "src/components/IconTile/IconTile.svelte";

  // Nothing outlives the page, so reloading it is a complete reset.
  const handleResetPress = () => {
    window.location.reload();
  };
</script>

<header
  class="sticky top-0 z-20 border-b border-stone-200/70 bg-stone-50/80 backdrop-blur dark:border-stone-800 dark:bg-stone-950/70"
>
  <div
    class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6"
  >
    <div class="mr-auto flex min-w-0 items-center gap-2">
      <IconTile icon={ICONS.flame} size="small" />
      <h1 class="text-lg font-semibold">Ledger</h1>
      <FlareStatusBadge />
    </div>
    <button
      type="button"
      onclick={handleResetPress}
      class={buttonStyles({ variant: "ghost", size: "small" })}
    >
      <BaseIcon src={ICONS.arrowCounterClockwise} size="small" />
      Reset demo
    </button>
  </div>
</header>
