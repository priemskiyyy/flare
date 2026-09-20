<script lang="ts">
  import type { Flare } from "@priemskiyyy/flare";
  import FlareProvider from "../context/FlareProvider.svelte";
  import Status from "./Status.fixture.svelte";

  type Props = { flare: Flare<Record<string, never>> };

  const props: Props = $props();
</script>

<FlareProvider flare={props.flare}><Status /></FlareProvider>
