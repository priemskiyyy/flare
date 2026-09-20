<script lang="ts">
  import type { Flare } from "@priemskiyyy/flare";
  import FlareProvider from "../context/FlareProvider.svelte";
  import type { FlareErrorBoundaryProps } from "../types/FlareErrorBoundaryProps.js";
  import FlareErrorBoundary from "./FlareErrorBoundary.svelte";
  import Widget from "./Widget.fixture.svelte";

  type Props = Pick<FlareErrorBoundaryProps, "capture" | "onError"> & {
    flare: Flare<Record<string, never>>;
    isBroken: () => boolean;
    onFallback?: (error: unknown) => void;
  };

  const { flare, isBroken, onFallback, capture, onError }: Props = $props();
</script>

<FlareProvider {flare}>
  <FlareErrorBoundary {capture} {onError}>
    <Widget {isBroken} />
    {#snippet fallback({ error, reset })}
      <button
        type="button"
        onclick={() => {
          onFallback?.(error);
          reset();
        }}
      >
        try again
      </button>
    {/snippet}
  </FlareErrorBoundary>
</FlareProvider>
