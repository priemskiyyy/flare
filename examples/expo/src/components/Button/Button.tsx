import type React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { COLORS } from "src/utils/constants/colors";

type ButtonProps = {
  label: string;
  variant: "primary" | "secondary";
  disabled?: boolean;
  onPress: () => void;
};

export const Button: React.FunctionComponent<ButtonProps> = ({
  label,
  variant,
  disabled = false,
  onPress,
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={[styles.button, styles[variant], disabled && styles.disabled]}
  >
    <Text style={[styles.label, variant === "primary" && styles.primaryLabel]}>
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  primary: { backgroundColor: COLORS.text },
  secondary: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  disabled: { opacity: 0.5 },
  label: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  primaryLabel: { color: COLORS.onAccent },
});
