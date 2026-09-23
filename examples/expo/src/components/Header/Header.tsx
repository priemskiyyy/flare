import { useFlareStatus } from "@priemskiyyy/flare-react";
import type React from "react";
import { StyleSheet, Text, View } from "react-native";

import { FLARE_STATUS_LABELS } from "examples/shared/ledger/constants/labels";
import { FLARE_STATUS_TONES } from "examples/shared/ui/constants/tones";
import { Badge } from "src/components/Badge/Badge";
import { COLORS } from "src/utils/constants/colors";

export const Header: React.FunctionComponent = () => {
  const { state } = useFlareStatus();

  return (
    <View style={styles.header}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>L</Text>
      </View>
      <Text role="heading" style={styles.title}>
        Ledger
      </Text>
      <View style={styles.status} accessibilityLiveRegion="polite">
        <Badge
          tone={FLARE_STATUS_TONES[state]}
          label={FLARE_STATUS_LABELS[state]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: COLORS.accent,
  },
  logoText: { fontSize: 17, fontWeight: "700", color: COLORS.onAccent },
  title: { fontSize: 24, fontWeight: "700", color: COLORS.text },
  status: { marginLeft: "auto" },
});
