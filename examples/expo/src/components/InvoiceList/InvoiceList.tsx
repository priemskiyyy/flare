import type { Receipt } from "@priemskiyyy/flare";
import type { RegisteredDestinationName } from "@priemskiyyy/flare-react";
import type React from "react";
import { StyleSheet, View } from "react-native";

import { ACCOUNTS } from "examples/shared/ledger/constants/accounts";
import { INVOICES } from "examples/shared/ledger/constants/invoices";
import type { AccountId } from "examples/shared/ledger/types/AccountId";
import { Card } from "src/components/Card/Card";
import { EmptyState } from "src/components/EmptyState/EmptyState";
import { InvoiceRow } from "src/components/InvoiceRow/InvoiceRow";
import { COLORS } from "src/utils/constants/colors";

type InvoiceListProps = {
  account: AccountId | null;
  onReceipt: (
    receipt: Receipt<RegisteredDestinationName>,
    action: string,
  ) => void;
};

export const InvoiceList: React.FunctionComponent<InvoiceListProps> = ({
  account,
  onReceipt,
}) => {
  if (account === null) {
    return (
      <Card title="Invoices" description="No company">
        <EmptyState
          title="Signed out"
          description="Sign in to see your invoices. Attachments and the preview still report, without a user."
        />
      </Card>
    );
  }

  const { company, plan } = ACCOUNTS[account];

  return (
    <Card
      title="Invoices"
      description={`${company} · ${plan}. Paying declines the card. A reminder bounces.`}
    >
      <View role="list" accessibilityLabel="Invoices" style={styles.list}>
        {INVOICES[account].map((invoice) => (
          <View key={invoice.id} role="listitem" style={styles.item}>
            <InvoiceRow invoice={invoice} onReceipt={onReceipt} />
          </View>
        ))}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  list: { marginVertical: -12 },
  item: { borderTopWidth: 1, borderTopColor: COLORS.sunken },
});
