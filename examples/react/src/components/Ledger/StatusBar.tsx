import { useFlare } from "@priemskiyyy/flare-react";
import type React from "react";

import { useObservable } from "src/hooks/useObservable";

/** What Flare's diagnostics say about the session, which carries no report content. */
export const StatusBar: React.FunctionComponent = () => {
  const flare = useFlare();
  const snapshot = useObservable(flare.diagnostics);

  return (
    <footer
      aria-label="Session"
      className="flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-200 px-4 py-2 font-mono text-xs text-stone-500 dark:border-stone-800"
    >
      <span className="font-semibold text-stone-600 dark:text-stone-300">
        Flare session
      </span>
      <span>identity #{snapshot.generation}</span>
      <span>breadcrumbs {snapshot.breadcrumbs}</span>
      <span>in flight {snapshot.pendingReceipts}</span>
    </footer>
  );
};
