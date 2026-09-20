<script lang="ts">
  import type { DestinationStatus, FlareStatus } from "@priemskiyyy/flare";
  import { useDestinationStatus } from "./useDestinationStatus.js";
  import { useFlareStatus } from "./useFlareStatus.js";

  type Props = {
    onFlare: (status: FlareStatus) => void;
    onDestination: (status: DestinationStatus) => void;
  };

  const props: Props = $props();
  const status = useFlareStatus((next) => props.onFlare(next));
  useDestinationStatus("primary", (next) => props.onDestination(next));
</script>

<span>{status.current.state}</span>
