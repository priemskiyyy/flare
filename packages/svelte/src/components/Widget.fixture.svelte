<script lang="ts">
  import { untrack } from "svelte";

  const props: { isBroken: () => boolean } = $props();

  // Read once on purpose: the fixture breaks while it is being created.
  if (untrack(() => props.isBroken())) {
    throw new Error("the widget could not render");
  }
</script>

<p>the widget renders</p>
