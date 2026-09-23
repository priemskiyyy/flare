import type React from "react";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { COLORS } from "src/utils/constants/colors";

type CardProps = { title: string; description: string; children: ReactNode };

export const Card: React.FunctionComponent<CardProps> = ({
  title,
  description,
  children,
}) => (
  <View role="region" accessibilityLabel={title} style={styles.card}>
    <View style={styles.header}>
      <Text role="heading" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.description}>{description}</Text>
    </View>
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  header: { gap: 4 },
  title: { fontSize: 16, fontWeight: "600", color: COLORS.text },
  description: { fontSize: 13, color: COLORS.muted },
});
