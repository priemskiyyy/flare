import type { Receipt } from "@priemskiyyy/flare";

import { createLedgerFlare } from "examples/shared/ledger/reporting/createLedgerFlare";
import type { AccountId } from "examples/shared/ledger/types/AccountId";
import type { ConsoleLine } from "examples/shared/ledger/types/ConsoleLine";
import type { LedgerDestination } from "examples/shared/ledger/types/LedgerDestination";
import type { ReportBackend } from "examples/shared/ledger/types/ReportBackend";
import type { SimulatedProviders } from "examples/shared/ledger/types/SimulatedProviders";
import type { TimelineEntry } from "examples/shared/ledger/types/TimelineEntry";
import type { TrackedReceipt } from "examples/shared/ledger/types/TrackedReceipt";
import { createEventLog } from "examples/shared/ledger/utils/createEventLog";

let nextRuntimeId = 1;

/**
 * One Flare and what the page shows about it: its receipts, its console and
 * its diagnostics. A disposed Flare cannot start again, so a restart is a
 * new runtime.
 */
export const createLedgerRuntime = ({
  backend,
  providers,
}: {
  backend: ReportBackend;
  providers: SimulatedProviders;
}) => {
  const consoleLines = createEventLog<ConsoleLine>(50);
  const receipts = createEventLog<TrackedReceipt>(20);
  const timeline = createEventLog<TimelineEntry>(80);
  const id = nextRuntimeId;
  let nextLineId = 1;
  let nextEventId = 1;

  nextRuntimeId += 1;

  const flare = createLedgerFlare({
    backend,
    providers,
    writer: ({ level, line, report }) => {
      consoleLines.add({ id: nextLineId, level, line, report, at: Date.now() });
      nextLineId += 1;
    },
  });

  const stopTimeline = flare.diagnostics.events.subscribe((event) => {
    timeline.add({ ...event, id: nextEventId });
    nextEventId += 1;
  });

  return {
    id,
    flare,
    receipts: receipts.log,
    timeline: timeline.log,
    consoleLines: consoleLines.log,
    track: (
      receipt: Receipt<LedgerDestination>,
      action: string,
      account: AccountId | null,
    ) => {
      receipts.add({ receipt, action, account, at: Date.now() });
    },
    /** Every report reaches the console, so its writer saw each one as sanitized. */
    findReport: (reportId: string) =>
      consoleLines.log
        .getSnapshot()
        .find((entry) => entry.report.id === reportId)?.report ?? null,
    dispose: () => {
      stopTimeline();
      flare.dispose();
    },
  };
};
