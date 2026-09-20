<!--
@component Publishes one Flare to the components below, and does nothing else.
The Flare owns its own lifetime: mounting the provider starts no destination
and unmounting it shuts none down.
@example `<FlareProvider {flare}><Application /></FlareProvider>`
-->
<script lang="ts">
  import { setContext } from "svelte";
  import { FLARE_CONTEXT } from "./FlareContext.js";
  import type { FlareContextValue } from "./FlareContext.js";
  import type { FlareProviderProps } from "../types/FlareProviderProps.js";

  const props: FlareProviderProps = $props();
  setContext(FLARE_CONTEXT, {
    get current() {
      return props.flare;
    },
  } satisfies FlareContextValue);
</script>

{#if props.children}
  {@render props.children()}
{/if}
