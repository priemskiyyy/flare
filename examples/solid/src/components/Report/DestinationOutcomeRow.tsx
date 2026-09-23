import type { DestinationOutcome } from "@priemskiyyy/flare";
import { useDestinationStatus } from "@priemskiyyy/flare-solid";
import { Show } from "solid-js";
import type { Component } from "solid-js";

import { DESTINATION_GUIDES } from "examples/shared/ledger/constants/destinations";
import {
  DESTINATION_STATUS_LABELS,
  OUTCOME_LABELS,
} from "examples/shared/ledger/constants/labels";
import { explainOutcome } from "examples/shared/ledger/formatting/explainOutcome";
import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import { getOutcomeCode } from "examples/shared/ledger/utils/getOutcomeCode";
import { getOutcomeStatus } from "examples/shared/ledger/utils/getOutcomeStatus";
import {
  DESTINATION_ICONS,
  OUTCOME_ICONS,
} from "examples/shared/ui/constants/icons";
import { OUTCOME_TONES } from "examples/shared/ui/constants/tones";
import { CODE_CLASS_NAME } from "examples/shared/ui/styles/codeStyles";
import { Badge } from "src/components/Badge/Badge";
import { BaseIcon } from "src/components/BaseIcon/BaseIcon";

type DestinationOutcomeRowProps = {
  destination: LedgerDestination;
  /** `undefined` when routing left this destination out, `null` until it answers. */
  outcome: DestinationOutcome | null | undefined;
};

export const DestinationOutcomeRow: Component<DestinationOutcomeRowProps> = (
  props,
) => {
  const destinationStatus = useDestinationStatus(() => props.destination);
  const status = () => getOutcomeStatus(props.outcome);

  return (
    <li
      aria-label={DESTINATION_GUIDES[props.destination].name}
      class="flex items-start gap-3 py-3"
      classList={{ "opacity-60": props.outcome === undefined }}
    >
      <span
        aria-hidden="true"
        class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
      >
        <BaseIcon src={DESTINATION_ICONS[props.destination]} size="regular" />
      </span>
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span class="flex flex-wrap items-baseline gap-x-2">
            <span class="font-medium">
              {DESTINATION_GUIDES[props.destination].name}
            </span>
            <span class="text-xs text-stone-500">
              {DESTINATION_STATUS_LABELS[destinationStatus().state]}
            </span>
          </span>
          <Badge tone={OUTCOME_TONES[status()]}>
            <BaseIcon
              src={OUTCOME_ICONS[status()]}
              size="xsmall"
              classList={{
                "animate-spin motion-reduce:animate-none":
                  status() === "pending",
              }}
            />
            {OUTCOME_LABELS[status()]}
          </Badge>
        </div>
        <p class="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          {explainOutcome(props.destination, props.outcome)}{" "}
          <Show when={getOutcomeCode(props.outcome)}>
            {(code) => <code class={CODE_CLASS_NAME}>{code()}</code>}
          </Show>
        </p>
      </div>
    </li>
  );
};
