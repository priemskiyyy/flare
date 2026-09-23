<script lang="ts">
  import type { ClassValue } from "svelte/elements";
  import { iconStyles } from "examples/shared/ui/styles/iconStyles";
  import type { IconSize } from "examples/shared/ui/types/IconSize";

  type Props = { src: string; size: IconSize; class?: ClassValue };

  let { src, size, class: className }: Props = $props();
</script>

<span
  aria-hidden="true"
  class={[iconStyles({ size }), className]}
  style:mask-image={`url("${src}")`}
></span>
