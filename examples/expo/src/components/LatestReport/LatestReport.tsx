import type React from "react";

import type { TrackedReceipt } from "examples/shared/ledger/types/TrackedReceipt";
import { Card } from "src/components/Card/Card";
import { EmptyState } from "src/components/EmptyState/EmptyState";
import { ReportSummary } from "src/components/ReportSummary/ReportSummary";

type LatestReportProps = { latest: TrackedReceipt | null };

export const LatestReport: React.FunctionComponent<LatestReportProps> = ({
  latest,
}) => (
  <Card
    title="Latest report"
    description="Where the last thing you did went: each destination, what it answered, and why."
  >
    {latest === null ? (
      <EmptyState
        title="Nothing reported yet"
        description="Press any button below. Each one fails on purpose, and its report lands here."
      />
    ) : (
      <ReportSummary key={latest.receipt.id} tracked={latest} />
    )}
  </Card>
);
