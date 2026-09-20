import { FlareErrorBoundary } from "@priemskiyyy/flare-react";
import { useState } from "react";

import { OrderWidget } from "src/components/Scenarios/OrderWidget";
import type { ExampleReport } from "src/types/ExampleReport";

export const BoundaryScenario = ({
  onReport,
}: {
  onReport: (report: ExampleReport) => void;
}) => {
  const [isBroken, setIsBroken] = useState(false);
  return (
    <section className="scenario" aria-labelledby="boundary-heading">
      <div className="scenario-heading">
        <span className="scenario-symbol" aria-hidden="true">
          {"{ }"}
        </span>
        <div>
          <h2 id="boundary-heading">Render boundary</h2>
          <p>A broken component should not take down the page.</p>
        </div>
        <span className="feature-tag">React</span>
      </div>
      <FlareErrorBoundary
        capture={{ tags: { area: "widget" } }}
        onError={({ receipt }) =>
          onReport({ title: "Widget render failed", receipt })
        }
        fallback={({ reset }) => (
          <div className="widget-fallback" role="alert">
            <div>
              <strong>The widget crashed and was reported.</strong>
              <span>The rest of the application is still running.</span>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setIsBroken(false);
                reset();
              }}
            >
              Reset widget
            </button>
          </div>
        )}
      >
        <OrderWidget isBroken={isBroken} />
      </FlareErrorBoundary>
      <div className="scenario-footer">
        <button
          className="secondary-button"
          type="button"
          disabled={isBroken}
          onClick={() => setIsBroken(true)}
        >
          Break the widget
        </button>
        <span>Includes React’s component stack.</span>
      </div>
    </section>
  );
};
