<script lang="ts">
  import { untrack } from "svelte";
  import { useFlareStatus } from "./useFlareStatus.js";

  const props: { beforeMount: string[] } = $props();
  const status = useFlareStatus();
  // Read once on purpose: what a status says before the component is mounted.
  untrack(() => props.beforeMount.push(status.current.state));
</script>

<span>{status.current.state}</span>
