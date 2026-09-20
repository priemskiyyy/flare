<!--
@component Reports an error caught by `svelte:boundary` in the tree below it,
and renders its `fallback` snippet. Svelte has no component stack, so the
report carries only what `capture` gives it.

Like every Svelte boundary it sees errors thrown while rendering and inside
effects. It does not see errors in event handlers or in asynchronous code:
report those with `flare.current.capture`.
@example `<FlareErrorBoundary capture={{ tags: { area: "cart" } }}><Cart /></FlareErrorBoundary>`
-->
<script lang="ts">
  import type { FlareErrorBoundaryProps } from "../types/FlareErrorBoundaryProps.js";
  import { useFlareContext } from "../utilities/internal/useFlareContext.js";

  const props: FlareErrorBoundaryProps = $props();
  const flare = useFlareContext("FlareErrorBoundary");

  // Svelte calls this once for each error it catches, which is when to report.
  const handleError = (error: unknown) => {
    const receipt = flare.current.capture(error, props.capture);

    if (typeof props.onError !== "function") {
      return;
    }

    props.onError({ error, receipt });
  };
</script>

<svelte:boundary onerror={handleError}>
  {#if props.children}
    {@render props.children()}
  {/if}
  {#snippet failed(error, reset)}
    {#if props.fallback}
      {@render props.fallback({ error, reset })}
    {/if}
  {/snippet}
</svelte:boundary>
