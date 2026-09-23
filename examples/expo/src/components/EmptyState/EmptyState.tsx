import type React from "react";
import { StyleSheet, Text, View } from "react-native";

import { COLORS } from "src/utils/constants/colors";

type EmptyStateProps = { title: string; description: string };

export const EmptyState: React.FunctionComponent<EmptyStateProps> = ({
  title,
  description,
}) => (
  <View style={styles.empty}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.description}>{description}</Text>
  </View>
);

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.faint,
  },
  title: { fontSize: 15, fontWeight: "500", color: COLORS.text },
  description: { fontSize: 13, textAlign: "center", color: COLORS.muted },
});
