import type { Receipt } from "@priemskiyyy/flare";
import { useFlare } from "@priemskiyyy/flare-react";
import type { RegisteredDestinationName } from "@priemskiyyy/flare-react";
import type React from "react";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { INITIAL_ACCOUNT } from "examples/shared/ledger/constants/accounts";
import type { AccountId } from "examples/shared/ledger/types/AccountId";
import type { TrackedReceipt } from "examples/shared/ledger/types/TrackedReceipt";
import { AccountSwitcher } from "src/components/AccountSwitcher/AccountSwitcher";
import { AttachmentUpload } from "src/components/AttachmentUpload/AttachmentUpload";
import { Header } from "src/components/Header/Header";
import { InvoiceList } from "src/components/InvoiceList/InvoiceList";
import { InvoicePreview } from "src/components/InvoicePreview/InvoicePreview";
import { LatestReport } from "src/components/LatestReport/LatestReport";
import { SessionFooter } from "src/components/SessionFooter/SessionFooter";
import { COLORS } from "src/utils/constants/colors";
import { switchAccount } from "src/utils/switchAccount";

export const Application: React.FunctionComponent = () => {
  const flare = useFlare();
  const [account, setAccount] = useState<AccountId | null>(INITIAL_ACCOUNT);
  const [latest, setLatest] = useState<TrackedReceipt | null>(null);

  const handleAccountSelect = (next: AccountId | null) => {
    setAccount(next);
    switchAccount(flare, next);
  };

  const handleReceipt = (
    receipt: Receipt<RegisteredDestinationName>,
    action: string,
  ) => {
    setLatest({ receipt, action, account, at: Date.now() });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Header />
      <AccountSwitcher
        account={account}
        onAccountSelect={handleAccountSelect}
      />
      <LatestReport latest={latest} />
      <InvoiceList account={account} onReceipt={handleReceipt} />
      <AttachmentUpload onReceipt={handleReceipt} />
      <InvoicePreview onReceipt={handleReceipt} />
      <SessionFooter />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { gap: 16, padding: 16, paddingTop: 64, paddingBottom: 40 },
});
