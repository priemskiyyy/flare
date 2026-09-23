import type React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Tone } from "examples/shared/ui/types/Tone";
import { COLORS, TONE_COLORS } from "src/utils/constants/colors";

type BadgeProps = { tone: Tone; label: string };

export const Badge: React.FunctionComponent<BadgeProps> = ({ tone, label }) => (
  <View style={styles.badge}>
    <View style={[styles.dot, { backgroundColor: TONE_COLORS[tone] }]} />
    <Text style={styles.label}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 12, fontWeight: "500", color: COLORS.body },
});
