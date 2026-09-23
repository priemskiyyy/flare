import type React from "react";
import { StyleSheet, Text } from "react-native";

import { COLORS } from "src/utils/constants/colors";

type InvoiceDocumentProps = { isBroken: boolean };

/** Throws while rendering, the one kind of error a boundary can see. */
export const InvoiceDocument: React.FunctionComponent<InvoiceDocumentProps> = ({
  isBroken,
}) => {
  if (isBroken) {
    throw new Error("The invoice template has no field tax.rate");
  }

  return (
    <Text style={styles.document}>The preview is rendering normally.</Text>
  );
};

const styles = StyleSheet.create({
  document: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: COLORS.sunken,
    fontSize: 13,
    color: COLORS.body,
  },
});
