<script lang="ts">
  import type { Flare } from "@priemskiyyy/flare";
  import FlareProvider from "../context/FlareProvider.svelte";
  import Named from "./Named.fixture.svelte";

  type Props = { flare: Flare<Record<string, never>>; name: string };

  const props: Props = $props();
</script>

<FlareProvider flare={props.flare}><Named name={props.name} /></FlareProvider>
