import type { Receipt } from "@priemskiyyy/flare";
import { useFlare } from "@priemskiyyy/flare-react";
import type { RegisteredDestinationName } from "@priemskiyyy/flare-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { Button } from "src/components/Button/Button";
import { Card } from "src/components/Card/Card";
import { COLORS } from "src/utils/constants/colors";

const UPLOAD_DURATION = 3_000;

type AttachmentUploadProps = {
  onReceipt: (
    receipt: Receipt<RegisteredDestinationName>,
    action: string,
  ) => void;
};

/** An operation belongs to the account that started it: switch accounts while it runs. */
export const AttachmentUpload: React.FunctionComponent<
  AttachmentUploadProps
> = ({ onReceipt }) => {
  const flare = useFlare();
  const [isUploading, setIsUploading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const handleUploadPress = () => {
    if (timer.current !== null) {
      return;
    }

    const upload = flare.scope({
      operation: "attach-receipt",
      tags: { area: "attachments" },
    });

    flare.breadcrumb("attachmentStarted", { file: "receipt.pdf" });
    setIsUploading(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setIsUploading(false);
      onReceipt(
        upload.capture(new Error("The upload of receipt.pdf timed out")),
        "Attach receipt.pdf",
      );
    }, UPLOAD_DURATION);
  };

  return (
    <Card title="Attachments" description="The upload fails after 3 seconds.">
      <Text role="status" style={styles.status}>
        {isUploading
          ? "Uploading receipt.pdf. Switch accounts now."
          : "Switch accounts before it fails."}
      </Text>
      <Button
        label="Attach receipt.pdf"
        variant="secondary"
        disabled={isUploading}
        onPress={handleUploadPress}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  status: { fontSize: 13, color: COLORS.body },
});
