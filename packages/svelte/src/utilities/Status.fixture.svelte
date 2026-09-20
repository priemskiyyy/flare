<script lang="ts">
  import { useDestinationStatus } from "./useDestinationStatus.js";
  import { useFlareStatus } from "./useFlareStatus.js";

  const flare = useFlareStatus();
  const primary = useDestinationStatus("primary");
</script>

<span>{flare.current.state}/{primary.current.state}</span>
