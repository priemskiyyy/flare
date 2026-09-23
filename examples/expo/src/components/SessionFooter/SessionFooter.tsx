import { useFlare } from "@priemskiyyy/flare-react";
import type React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useObservable } from "src/hooks/useObservable";
import { COLORS } from "src/utils/constants/colors";

/** What Flare's diagnostics say about the session, which carries no report content. */
export const SessionFooter: React.FunctionComponent = () => {
  const flare = useFlare();
  const snapshot = useObservable(flare.diagnostics);

  return (
    <View role="contentinfo" accessibilityLabel="Session" style={styles.footer}>
      <Text style={[styles.text, styles.label]}>Flare session</Text>
      <Text style={styles.text}>identity #{snapshot.generation}</Text>
      <Text style={styles.text}>breadcrumbs {snapshot.breadcrumbs}</Text>
      <Text style={styles.text}>in flight {snapshot.pendingReceipts}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 4,
  },
  text: { fontFamily: "Menlo", fontSize: 12, color: COLORS.muted },
  label: { fontWeight: "600", color: COLORS.body },
});
