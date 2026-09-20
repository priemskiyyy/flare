<script lang="ts">
  import type {
    DestinationStatus,
    Flare,
    FlareStatus,
  } from "@priemskiyyy/flare";
  import FlareProvider from "../context/FlareProvider.svelte";
  import Observed from "./Observed.fixture.svelte";

  type Props = {
    flare: Flare<Record<string, never>>;
    onFlare: (status: FlareStatus) => void;
    onDestination: (status: DestinationStatus) => void;
  };

  const props: Props = $props();
</script>

<FlareProvider flare={props.flare}>
  <Observed onFlare={props.onFlare} onDestination={props.onDestination} />
</FlareProvider>
