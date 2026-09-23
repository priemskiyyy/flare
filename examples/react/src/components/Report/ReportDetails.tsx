import { Prohibit } from "@phosphor-icons/react";
import type { Receipt, SanitizedReport } from "@priemskiyyy/flare";
import type React from "react";

import { ReportFlow } from "src/components/Report/ReportFlow";
import { SanitizedPayload } from "src/components/Report/SanitizedPayload";
import { explainDrop } from "src/formatting/explainDrop";
import { useObservable } from "src/hooks/useObservable";
import { CODE_CLASS_NAME } from "src/styles/codeStyles";
import type { LedgerDestination } from "src/types/LedgerDestination";

type ReportDetailsProps = {
  receipt: Receipt<LedgerDestination>;
  report: SanitizedReport | null;
};

export const ReportDetails: React.FunctionComponent<ReportDetailsProps> = ({
  receipt,
  report,
}) => {
  const status = useObservable(receipt.status);

  if (status.state === "dropped") {
    return (
      <div
        role="note"
        className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-950/40"
      >
        <Prohibit
          aria-hidden="true"
          size={20}
          weight="duotone"
          className="mt-0.5 shrink-0 text-stone-500"
        />
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-semibold">No destination got this report</p>
          <p className="leading-relaxed text-stone-600 dark:text-stone-400">
            {explainDrop(status.reason)}{" "}
            <code className={CODE_CLASS_NAME}>{status.reason}</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ReportFlow outcomes={status.outcomes} />
      <SanitizedPayload report={report} />
    </div>
  );
};
