import type { Receipt } from "@priemskiyyy/flare";
import { useFlare } from "@priemskiyyy/flare-react";
import type { RegisteredDestinationName } from "@priemskiyyy/flare-react";
import type React from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatMoney } from "examples/shared/ledger/formatting/formatMoney";
import type { Invoice } from "examples/shared/ledger/types/Invoice";
import { PaymentDeclinedError } from "examples/shared/ledger/utils/PaymentDeclinedError";
import { Button } from "src/components/Button/Button";
import { COLORS } from "src/utils/constants/colors";

type InvoiceRowProps = {
  invoice: Invoice;
  onReceipt: (
    receipt: Receipt<RegisteredDestinationName>,
    action: string,
  ) => void;
};

export const InvoiceRow: React.FunctionComponent<InvoiceRowProps> = ({
  invoice,
  onReceipt,
}) => {
  const flare = useFlare();

  const handlePayPress = () => {
    flare.breadcrumb("invoiceOpened", { invoice: invoice.id });

    const receipt = flare.capture(
      new PaymentDeclinedError(`The card for ${invoice.id} was declined`),
      {
        tags: { area: "billing" },
        contexts: {
          payment: {
            invoice: invoice.id,
            amount: invoice.amount,
            cardToken: "tok_live_4242",
            iban: "DE89 3704 0044 0532 0130 00",
          },
        },
      },
    );

    onReceipt(receipt, `Pay ${invoice.id}`);
  };

  const handleRemindPress = () => {
    const receipt = flare.message(
      `The reminder to ${invoice.customerEmail} bounced`,
      { level: "warning", tags: { area: "reminders" } },
    );

    onReceipt(receipt, `Remind ${invoice.customer}`);
  };

  return (
    <View style={styles.row}>
      <View style={styles.summary}>
        <View style={styles.names}>
          <Text style={styles.customer}>{invoice.customer}</Text>
          <Text style={styles.meta}>
            {invoice.id} · due {invoice.due}
          </Text>
        </View>
        <Text style={styles.amount}>{formatMoney(invoice.amount)}</Text>
      </View>
      <View style={styles.actions}>
        <Button
          label={`Pay ${invoice.id}`}
          variant="primary"
          onPress={handlePayPress}
        />
        <Button
          label={`Remind ${invoice.customer}`}
          variant="secondary"
          onPress={handleRemindPress}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { gap: 10, paddingVertical: 12 },
  summary: { flexDirection: "row", alignItems: "center", gap: 12 },
  names: { flex: 1, gap: 2 },
  customer: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  meta: { fontFamily: "Menlo", fontSize: 12, color: COLORS.muted },
  amount: { fontFamily: "Menlo", fontSize: 14, color: COLORS.text },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
