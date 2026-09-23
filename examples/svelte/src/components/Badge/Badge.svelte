<script lang="ts">
  import type { Snippet } from "svelte";
  import { badgeStyles } from "examples/shared/ui/styles/badgeStyles";
  import type { Tone } from "examples/shared/ui/types/Tone";

  type Props = { tone: Tone; children: Snippet };

  let { tone, children }: Props = $props();
</script>

<span class={badgeStyles({ tone })}>{@render children()}</span>
