import { useState } from "react";

import type { createExampleBackend } from "src/backend/createExampleBackend";
import { Header } from "src/components/Header/Header";
import { ReportPanel } from "src/components/ReportPanel/ReportPanel";
import { BoundaryScenario } from "src/components/Scenarios/BoundaryScenario";
import { PaymentScenario } from "src/components/Scenarios/PaymentScenario";
import { UploadScenario } from "src/components/Scenarios/UploadScenario";
import type { ExampleReport } from "src/types/ExampleReport";
import "src/components/Scenarios/Scenarios.css";

export const Application = ({
  backend,
}: {
  backend: ReturnType<typeof createExampleBackend>;
}) => {
  const [report, setReport] = useState<ExampleReport | null>(null);

  return (
    <>
      <Header />
      <main id="main" className="application-main">
        <div className="page-intro">
          <div>
            <h1>See where a report goes.</h1>
            <p>
              Trigger a failure, inspect the sanitized payload, and follow
              delivery to each destination.
            </p>
          </div>
          <a
            className="documentation-link"
            href="https://priemskiyyy.github.io/flare/"
          >
            Read the docs <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="playground-layout">
          <div className="scenario-list">
            <PaymentScenario onReport={setReport} />
            <UploadScenario onReport={setReport} />
            <BoundaryScenario onReport={setReport} />
          </div>
          <ReportPanel
            report={report}
            received={backend.report}
            onClear={() => setReport(null)}
          />
        </div>
        <footer className="application-footer">
          <span>
            One runtime. Two destinations. No provider account required.
          </span>
          <a href="https://github.com/priemskiyyy/flare/tree/main/examples/react">
            View example source
          </a>
        </footer>
      </main>
      {report === null ? null : (
        <a className="report-shortcut" href="#report-heading">
          View latest report <span aria-hidden="true">↓</span>
        </a>
      )}
    </>
  );
};
