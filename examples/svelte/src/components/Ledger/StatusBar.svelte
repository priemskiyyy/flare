<script lang="ts">
  import { useFlare } from "@priemskiyyy/flare-svelte";
  import { useExternalStore } from "src/utilities/useExternalStore";

  const flare = useFlare();

  const snapshot = useExternalStore(
    (listener) => flare.current.diagnostics.subscribe(listener),
    () => flare.current.diagnostics.get(),
  );
</script>

<!-- What Flare's diagnostics say about the session, which carries no report content. -->
<footer
  aria-label="Session"
  class="flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-200 px-4 py-2 font-mono text-xs text-stone-500 dark:border-stone-800"
>
  <span class="font-semibold text-stone-600 dark:text-stone-300">
    Flare session
  </span>
  <span>identity #{snapshot.current.generation}</span>
  <span>breadcrumbs {snapshot.current.breadcrumbs}</span>
  <span>in flight {snapshot.current.pendingReceipts}</span>
</footer>
