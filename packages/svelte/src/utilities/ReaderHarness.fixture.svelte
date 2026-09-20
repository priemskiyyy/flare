<script lang="ts">
  import type { Flare } from "@priemskiyyy/flare";
  import FlareProvider from "../context/FlareProvider.svelte";
  import Reader from "./Reader.fixture.svelte";

  type Props = { flare: Flare<Record<string, never>>; seen: unknown[] };

  const props: Props = $props();
</script>

<FlareProvider flare={props.flare}><Reader seen={props.seen} /></FlareProvider>
