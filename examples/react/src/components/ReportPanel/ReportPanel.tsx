import type { createExampleBackend } from "src/backend/createExampleBackend";
import { ReceiptView } from "src/components/ReportPanel/ReceiptView";
import type { ExampleReport } from "src/types/ExampleReport";
import "src/components/ReportPanel/ReportPanel.css";

type ReportPanelProps = {
  report: ExampleReport | null;
  received: ReturnType<typeof createExampleBackend>["report"];
  onClear: () => void;
};

export const ReportPanel = ({
  report,
  received,
  onClear,
}: ReportPanelProps) => (
  <section className="report-panel" aria-labelledby="report-heading">
    <div className="report-panel-heading">
      <h2 id="report-heading" tabIndex={-1}>
        Latest report
      </h2>
      {report === null ? (
        <span className="live-label">
          <span className="status-dot" />
          Listening
        </span>
      ) : (
        <button className="text-button" type="button" onClick={onClear}>
          Clear view
        </button>
      )}
    </div>
    {report === null ? (
      <div className="report-empty">
        <div className="empty-graphic" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h3>Trigger a failure to begin.</h3>
        <p>
          Run a scenario to see its context, delivery results, and the exact
          payload that leaves your app.
        </p>
        <code>flare.capture(error)</code>
        <div
          className="report-route"
          aria-label="Reports go through Flare to the backend and console"
        >
          <span>Your app</span>
          <span aria-hidden="true">→</span>
          <strong>Flare</strong>
          <span aria-hidden="true">→</span>
          <span>2 destinations</span>
        </div>
      </div>
    ) : (
      <ReceiptView
        key={report.receipt.id}
        report={report}
        received={received}
      />
    )}
    <div className="report-panel-footer">
      <span className="status-dot" /> All reports stay in this browser.
    </div>
  </section>
);
