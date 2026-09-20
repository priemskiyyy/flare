<script lang="ts">
  import { useDestinationStatus } from "./useDestinationStatus.js";

  const props: { name: string } = $props();
  const status = useDestinationStatus(() => props.name);
</script>

<span>{status.current.state}</span>
