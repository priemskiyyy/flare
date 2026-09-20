import type { ReceiptStatus } from "@priemskiyyy/flare";
import { useSyncExternalStore } from "react";

import type { createExampleBackend } from "src/backend/createExampleBackend";
import { formatOutcome } from "src/formatting/formatOutcome";
import type { ExampleReport } from "src/types/ExampleReport";

const STATUS_LABELS = {
  pending: "Sending",
  settled: "Complete",
  dropped: "Not sent",
} satisfies Record<ReceiptStatus["state"], string>;

type ReceiptViewProps = {
  report: ExampleReport;
  received: ReturnType<typeof createExampleBackend>["report"];
};

/** A receipt is observable, so the pending outcomes fill in as they settle. */
export const ReceiptView = ({
  report: { title, receipt },
  received,
}: ReceiptViewProps) => {
  const status = useSyncExternalStore(
    receipt.status.subscribe,
    receipt.status.get,
  );
  const payload = useSyncExternalStore(received.subscribe, received.get);

  return (
    <div className="receipt-content">
      <div className="receipt-heading">
        <div>
          <h3>{title}</h3>
          <code title={receipt.id}>{receipt.id}</code>
        </div>
        <span className="receipt-state" data-state={status.state} role="status">
          {STATUS_LABELS[status.state]}
        </span>
      </div>
      {status.state === "dropped" ? (
        <div className="report-notice">
          <strong>Report not sent</strong>
          <p>
            {status.reason === "stale-scope"
              ? "The account changed while this operation was running. Neither destination received its report."
              : "Flare stopped this report before it reached a destination."}
          </p>
          <code>{status.reason}</code>
        </div>
      ) : (
        <ul className="destination-outcomes" aria-label="Delivery results">
          {Object.entries(status.outcomes).map(([name, outcome]) => {
            const presentation = formatOutcome(outcome ?? null);
            return (
              <li key={name} data-status={outcome?.status ?? "pending"}>
                <span className="outcome-mark" aria-hidden="true">
                  {outcome?.status === "submitted" ? "✓" : "·"}
                </span>
                <div>
                  <strong>{name}</strong>
                  <span>{presentation.detail}</span>
                </div>
                <span className="outcome-label">{presentation.label}</span>
              </li>
            );
          })}
        </ul>
      )}
      {payload?.id === receipt.id ? (
        <div className="payload-section">
          <div className="payload-heading">
            <h3>Sanitized payload</h3>
            <span>Received by the demo backend</span>
          </div>
          <pre className="payload-code" aria-label="Sanitized payload">
            {JSON.stringify(payload.body, null, 2)}
          </pre>
        </div>
      ) : null}
      <details className="receipt-json">
        <summary>Receipt JSON</summary>
        <pre aria-label="Last receipt">
          {JSON.stringify({ id: receipt.id, ...status }, null, 2)}
        </pre>
      </details>
    </div>
  );
};
