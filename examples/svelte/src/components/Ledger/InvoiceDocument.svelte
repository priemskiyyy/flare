<script lang="ts">
  import { ICONS } from "examples/shared/ui/constants/icons";
  import BaseIcon from "src/components/BaseIcon/BaseIcon.svelte";

  type Props = { isBroken: boolean };

  let { isBroken }: Props = $props();

  // Throws while rendering, the one kind of error a boundary can see.
  const text = $derived.by(() => {
    if (isBroken) {
      throw new Error("The invoice template has no field tax.rate");
    }

    return "The preview is rendering normally.";
  });
</script>

<p
  class="flex items-center gap-2 rounded-lg bg-stone-100/80 px-3 py-2 text-sm text-stone-600 dark:bg-stone-800/60 dark:text-stone-400"
>
  <BaseIcon src={ICONS.fileText} size="regular" />
  {text}
</p>
