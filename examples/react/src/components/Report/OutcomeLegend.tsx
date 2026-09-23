import type React from "react";

import {
  OUTCOME_MEANINGS,
  OUTCOME_ORDER,
} from "examples/shared/ledger/constants/labels";
import { OutcomeBadge } from "src/components/Badge/OutcomeBadge";

export const OutcomeLegend: React.FunctionComponent = () => (
  <div className="flex flex-col gap-3 rounded-xl bg-stone-100/70 p-4 dark:bg-stone-800/40">
    <h4 className="text-sm font-semibold text-stone-700 dark:text-stone-300">
      What each answer means
    </h4>
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
      {OUTCOME_ORDER.map((status) => (
        <div key={status} className="flex flex-col items-start gap-1">
          <dt>
            <OutcomeBadge status={status} />
          </dt>
          <dd className="text-stone-600 dark:text-stone-400">
            {OUTCOME_MEANINGS[status]}
          </dd>
        </div>
      ))}
    </dl>
  </div>
);
