<script lang="ts">
  import type { Flare } from "@priemskiyyy/flare";
  import { FlareProvider } from "@priemskiyyy/flare-svelte";
  import Host from "src/svelteHost.fixture.svelte";

  const props: { flare: Flare<Record<string, never>> } = $props();
</script>

<FlareProvider flare={props.flare}>
  <Host />
</FlareProvider>
