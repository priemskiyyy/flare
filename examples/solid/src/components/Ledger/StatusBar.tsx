import { useFlare } from "@priemskiyyy/flare-solid";
import type { Component } from "solid-js";

import { useExternalStore } from "src/primitives/useExternalStore";

/** What Flare's diagnostics say about the session, which carries no report content. */
export const StatusBar: Component = () => {
  const flare = useFlare();
  const { diagnostics } = flare();
  const snapshot = useExternalStore(diagnostics.subscribe, diagnostics.get);

  return (
    <footer
      aria-label="Session"
      class="flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-200 px-4 py-2 font-mono text-xs text-stone-500 dark:border-stone-800"
    >
      <span class="font-semibold text-stone-600 dark:text-stone-300">
        Flare session
      </span>
      <span>identity #{snapshot().generation}</span>
      <span>breadcrumbs {snapshot().breadcrumbs}</span>
      <span>in flight {snapshot().pendingReceipts}</span>
    </footer>
  );
};
