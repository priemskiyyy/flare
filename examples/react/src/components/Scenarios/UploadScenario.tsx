import { useFlare } from "@priemskiyyy/flare-react";
import { useEffect, useRef, useState } from "react";

import type { ExampleReport } from "src/types/ExampleReport";

export const UploadScenario = ({
  onReport,
}: {
  onReport: (report: ExampleReport) => void;
}) => {
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

  const handleUpload = () => {
    if (timer.current !== null) {
      return;
    }
    const upload = flare.scope({
      operation: "upload-avatar",
      tags: { area: "upload" },
    });
    flare.breadcrumb("uploadStarted", { file: { name: "avatar.png" } });
    setIsUploading(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setIsUploading(false);
      onReport({
        title: "Upload timed out",
        receipt: upload.capture(new Error("The upload timed out")),
      });
    }, 3000);
  };

  return (
    <section className="scenario" aria-labelledby="upload-heading">
      <div className="scenario-heading">
        <span className="scenario-symbol" aria-hidden="true">
          ↑
        </span>
        <div>
          <h2 id="upload-heading">Background upload</h2>
          <p>An operation belongs to the account that started it.</p>
        </div>
        <span className="feature-tag">Scopes</span>
      </div>
      <div className="upload-preview" data-uploading={isUploading}>
        <span className="file-symbol" aria-hidden="true">
          ↥
        </span>
        <div>
          <strong>avatar.png</strong>
          <span role="status">
            {isUploading
              ? "Uploading avatar.png. Switch accounts now."
              : "Ready to upload. Fails after 3 seconds."}
          </span>
        </div>
        <span className="upload-progress" aria-hidden="true" />
      </div>
      <div className="scenario-footer">
        <button
          className="secondary-button"
          type="button"
          onClick={handleUpload}
          disabled={isUploading}
        >
          {isUploading ? "Uploading…" : "Start upload"}
        </button>
        <span>Switch to another account before it finishes.</span>
      </div>
    </section>
  );
};
