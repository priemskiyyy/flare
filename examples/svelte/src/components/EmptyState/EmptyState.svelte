<script lang="ts">
  import BaseIcon from "src/components/BaseIcon/BaseIcon.svelte";

  type Props = { icon: string; title: string; description: string };

  let { icon, title, description }: Props = $props();
</script>

<div
  class="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center dark:border-stone-700"
>
  <BaseIcon src={icon} size="large" class="text-stone-400" />
  <p class="text-base font-medium">{title}</p>
  <p class="max-w-sm text-sm text-stone-500 dark:text-stone-400">
    {description}
  </p>
</div>
