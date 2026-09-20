<script lang="ts">
  import { useFlare } from "./useFlare.js";

  const props: { seen: unknown[] } = $props();
  const flare = useFlare();

  $effect.pre(() => {
    props.seen.push(flare.current);
  });
</script>
