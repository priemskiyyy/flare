import type { DestinationOutcome } from "@priemskiyyy/flare";
import type { RegisteredDestinationName } from "@priemskiyyy/flare-react";
import type React from "react";
import { StyleSheet, Text, View } from "react-native";

import { DESTINATION_GUIDES } from "examples/shared/ledger/constants/destinations";
import { OUTCOME_LABELS } from "examples/shared/ledger/constants/labels";
import { explainOutcome } from "examples/shared/ledger/formatting/explainOutcome";
import { getOutcomeCode } from "examples/shared/ledger/utils/getOutcomeCode";
import { getOutcomeStatus } from "examples/shared/ledger/utils/getOutcomeStatus";
import { OUTCOME_TONES } from "examples/shared/ui/constants/tones";
import { Badge } from "src/components/Badge/Badge";
import { COLORS } from "src/utils/constants/colors";

type DestinationOutcomeRowProps = {
  destination: RegisteredDestinationName;
  /** `null` until the destination answers. */
  outcome: DestinationOutcome | null | undefined;
};

export const DestinationOutcomeRow: React.FunctionComponent<
  DestinationOutcomeRowProps
> = ({ destination, outcome }) => {
  const { name } = DESTINATION_GUIDES[destination];
  const status = getOutcomeStatus(outcome);
  const code = getOutcomeCode(outcome);

  return (
    <View role="listitem" accessibilityLabel={name} style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.name}>{name}</Text>
        <Badge tone={OUTCOME_TONES[status]} label={OUTCOME_LABELS[status]} />
      </View>
      <Text style={styles.explanation}>
        {explainOutcome(destination, outcome)}
      </Text>
      {code === null ? null : <Text style={styles.code}>{code}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    gap: 4,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.sunken,
  },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: { fontSize: 15, fontWeight: "500", color: COLORS.text },
  explanation: { fontSize: 13, lineHeight: 19, color: COLORS.body },
  code: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: COLORS.sunken,
    fontFamily: "Menlo",
    fontSize: 11,
    color: COLORS.muted,
  },
});
