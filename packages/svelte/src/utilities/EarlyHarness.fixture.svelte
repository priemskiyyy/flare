<script lang="ts">
  import type { Flare } from "@priemskiyyy/flare";
  import FlareProvider from "../context/FlareProvider.svelte";
  import Early from "./Early.fixture.svelte";

  type Props = { flare: Flare<Record<string, never>>; beforeMount: string[] };

  const props: Props = $props();
</script>

<FlareProvider flare={props.flare}
  ><Early beforeMount={props.beforeMount} /></FlareProvider
>
