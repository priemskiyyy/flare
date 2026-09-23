import { For, Show } from "solid-js";
import type { Component } from "solid-js";

import { DESTINATION_NAMES } from "examples/shared/ledger/constants/destinations";
import { RECEIPT_LABELS } from "examples/shared/ledger/constants/labels";
import { explainDrop } from "examples/shared/ledger/formatting/explainDrop";
import { formatAccount } from "examples/shared/ledger/formatting/formatAccount";
import { formatClockTime } from "examples/shared/ledger/formatting/formatClockTime";
import { formatShortId } from "examples/shared/ledger/formatting/formatShortId";
import type { LedgerRuntime } from "examples/shared/ledger/types/LedgerRuntime";
import type { TrackedReceipt } from "examples/shared/ledger/types/TrackedReceipt";
import { ICONS } from "examples/shared/ui/constants/icons";
import { RECEIPT_TONES } from "examples/shared/ui/constants/tones";
import { CARD_CLASS_NAME } from "examples/shared/ui/styles/cardStyles";
import { CODE_CLASS_NAME } from "examples/shared/ui/styles/codeStyles";
import { Badge } from "src/components/Badge/Badge";
import { BaseIcon } from "src/components/BaseIcon/BaseIcon";
import { EmptyState } from "src/components/EmptyState/EmptyState";
import { IconTile } from "src/components/IconTile/IconTile";
import { DestinationOutcomeRow } from "src/components/Report/DestinationOutcomeRow";
import { useExternalStore } from "src/primitives/useExternalStore";

type LatestReportProps = { tracked: TrackedReceipt };

const LatestReport: Component<LatestReportProps> = (props) => {
  const { receipt } = props.tracked;
  const status = useExternalStore(receipt.status.subscribe, receipt.status.get);

  const dropReason = () => {
    const current = status();

    if (current.state !== "dropped") {
      return null;
    }

    return current.reason;
  };

  const outcomes = () => {
    const current = status();

    if (current.state === "dropped") {
      return null;
    }

    return current.outcomes;
  };

  return (
    <div class="-m-2 flex animate-flash flex-col gap-4 rounded-xl p-2 motion-reduce:animate-none">
      <div class="flex flex-col gap-1">
        <div class="flex flex-wrap items-center gap-2">
          <p class="text-lg font-semibold tracking-tight">
            {props.tracked.action}
          </p>
          <Badge tone={RECEIPT_TONES[status().state]}>
            {RECEIPT_LABELS[status().state]}
          </Badge>
        </div>
        <p class="text-sm text-stone-500">
          {formatAccount(props.tracked.account)} ·{" "}
          {formatClockTime(props.tracked.at)} ·{" "}
          <span class="font-mono">{formatShortId(receipt.id)}</span>
        </p>
      </div>
      <Show when={dropReason()}>
        {(reason) => (
          <div
            role="note"
            class="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-950/40"
          >
            <BaseIcon
              src={ICONS.prohibit}
              size="large"
              class="mt-0.5 text-stone-500"
            />
            <div class="flex flex-col gap-1 text-sm">
              <p class="font-semibold">No destination got this report</p>
              <p class="leading-relaxed text-stone-600 dark:text-stone-400">
                {explainDrop(reason())}{" "}
                <code class={CODE_CLASS_NAME}>{reason()}</code>
              </p>
            </div>
          </div>
        )}
      </Show>
      <Show when={outcomes()}>
        {(current) => (
          <ul
            aria-label="Destination outcomes"
            class="flex flex-col divide-y divide-stone-200/70 dark:divide-stone-800"
          >
            <For each={DESTINATION_NAMES}>
              {(destination) => (
                <DestinationOutcomeRow
                  destination={destination}
                  outcome={current()[destination]}
                />
              )}
            </For>
          </ul>
        )}
      </Show>
    </div>
  );
};

type LatestReportPanelProps = { runtime: LedgerRuntime };

export const LatestReportPanel: Component<LatestReportPanelProps> = (props) => {
  const { receipts } = props.runtime;
  const tracked = useExternalStore(receipts.subscribe, receipts.getSnapshot);

  return (
    <section
      aria-label="Latest report"
      class={`flex h-full min-w-0 flex-col gap-4 p-5 ${CARD_CLASS_NAME}`}
    >
      <header class="flex flex-col gap-1.5">
        <div class="flex flex-wrap items-center gap-2">
          <IconTile src={ICONS.broadcast} size="small" />
          <h3 class="text-base font-semibold tracking-tight text-stone-800 dark:text-stone-200">
            Latest report
          </h3>
        </div>
        <p class="text-sm text-stone-500 dark:text-stone-400">
          Where the last thing you did went: every destination, what it
          answered, and why.
        </p>
      </header>
      {/* Keyed by the receipt, so each new report mounts afresh and flashes. */}
      <Show
        when={tracked()[0]}
        keyed
        fallback={
          <EmptyState
            icon={ICONS.broadcast}
            title="Nothing reported yet"
            description="Press any button in Ledger. Each one fails on purpose, and its report lands here."
          />
        }
      >
        {(latest) => <LatestReport tracked={latest} />}
      </Show>
    </section>
  );
};
