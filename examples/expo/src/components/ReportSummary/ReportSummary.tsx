import type React from "react";
import { StyleSheet, Text, View } from "react-native";

import { RECEIPT_LABELS } from "examples/shared/ledger/constants/labels";
import { explainDrop } from "examples/shared/ledger/formatting/explainDrop";
import { formatAccount } from "examples/shared/ledger/formatting/formatAccount";
import { formatClockTime } from "examples/shared/ledger/formatting/formatClockTime";
import { formatShortId } from "examples/shared/ledger/formatting/formatShortId";
import type { TrackedReceipt } from "examples/shared/ledger/types/TrackedReceipt";
import { RECEIPT_TONES } from "examples/shared/ui/constants/tones";
import { Badge } from "src/components/Badge/Badge";
import { DestinationOutcomeRow } from "src/components/DestinationOutcomeRow/DestinationOutcomeRow";
import { useObservable } from "src/hooks/useObservable";
import { COLORS } from "src/utils/constants/colors";
import { REPORT_DESTINATIONS } from "src/utils/constants/destinations";

type ReportSummaryProps = { tracked: TrackedReceipt };

const Outcomes: React.FunctionComponent<ReportSummaryProps> = ({ tracked }) => {
  const status = useObservable(tracked.receipt.status);

  if (status.state === "dropped") {
    return (
      <View role="note" style={styles.dropped}>
        <Text style={styles.droppedTitle}>No destination got this report</Text>
        <Text style={styles.droppedText}>{explainDrop(status.reason)}</Text>
        <Text style={styles.code}>{status.reason}</Text>
      </View>
    );
  }

  return (
    <View role="list" accessibilityLabel="Destination outcomes">
      {REPORT_DESTINATIONS.map((destination) => (
        <DestinationOutcomeRow
          key={destination}
          destination={destination}
          outcome={status.outcomes[destination]}
        />
      ))}
    </View>
  );
};

export const ReportSummary: React.FunctionComponent<ReportSummaryProps> = ({
  tracked,
}) => {
  const { state } = useObservable(tracked.receipt.status);

  return (
    <View style={styles.summary}>
      <View style={styles.title}>
        <Text style={styles.action}>{tracked.action}</Text>
        <Badge tone={RECEIPT_TONES[state]} label={RECEIPT_LABELS[state]} />
      </View>
      <Text style={styles.meta}>
        {formatAccount(tracked.account)} · {formatClockTime(tracked.at)} ·{" "}
        {formatShortId(tracked.receipt.id)}
      </Text>
      <Outcomes tracked={tracked} />
    </View>
  );
};

const styles = StyleSheet.create({
  summary: { gap: 8 },
  title: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  action: { fontSize: 17, fontWeight: "600", color: COLORS.text },
  meta: { fontSize: 13, color: COLORS.muted },
  dropped: {
    gap: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.sunken,
  },
  droppedTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  droppedText: { fontSize: 13, lineHeight: 19, color: COLORS.body },
  code: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: COLORS.surface,
    fontFamily: "Menlo",
    fontSize: 11,
    color: COLORS.muted,
  },
});
