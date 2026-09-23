import type { Receipt } from "@priemskiyyy/flare";
import { FlareErrorBoundary } from "@priemskiyyy/flare-react";
import type { RegisteredDestinationName } from "@priemskiyyy/flare-react";
import type React from "react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "src/components/Button/Button";
import { Card } from "src/components/Card/Card";
import { InvoiceDocument } from "src/components/InvoiceDocument/InvoiceDocument";
import { COLORS } from "src/utils/constants/colors";

type InvoicePreviewProps = {
  onReceipt: (
    receipt: Receipt<RegisteredDestinationName>,
    action: string,
  ) => void;
};

export const InvoicePreview: React.FunctionComponent<InvoicePreviewProps> = ({
  onReceipt,
}) => {
  const [isBroken, setIsBroken] = useState(false);

  const handleResetPress = (reset: () => void) => {
    setIsBroken(false);
    reset();
  };

  return (
    <Card
      title="Preview"
      description="Breaking it throws while rendering, and the error boundary reports it."
    >
      <FlareErrorBoundary
        capture={{ tags: { area: "preview" } }}
        onError={({ receipt }) => onReceipt(receipt, "Render the preview")}
        fallback={({ reset }) => (
          <View role="alert" style={styles.fallback}>
            <Text style={styles.fallbackText}>
              The preview crashed and was reported.
            </Text>
            <Button
              label="Reset the preview"
              variant="secondary"
              onPress={() => handleResetPress(reset)}
            />
          </View>
        )}
      >
        <InvoiceDocument isBroken={isBroken} />
      </FlareErrorBoundary>
      <Button
        label="Break the preview"
        variant="secondary"
        disabled={isBroken}
        onPress={() => setIsBroken(true)}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  fallback: {
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerSoft,
  },
  fallbackText: { fontSize: 13, color: COLORS.dangerText },
});
